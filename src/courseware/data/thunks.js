import { logError, logInfo } from '@edx/frontend-platform/logging';
import {
  getBlockCompletion,
  postSequencePosition,
  getCourseMetadata,
  getCourseBlocks,
  getLearningSequencesOutline,
  getSequenceMetadata,
  postIntegritySignature,
} from './api';
import {
  updateModel, addModel, updateModelsMap, addModelsMap, updateModels,
} from '../../generic/model-store';
import {
  setsSpecialExamsEnabled,
  setsProctoredExamsEnabled,
  setsShortLinkFeatureFlag,
  fetchCourseRequest,
  fetchCourseSuccess,
  fetchCourseFailure,
  fetchCourseDenied,
  fetchSequenceRequest,
  fetchSequenceSuccess,
  fetchSequenceFailure,
} from './slice';

/**
 * Combines the models from the Course Blocks and Learning Sequences API into a
 * new models obj that is returned. Does not mutate the models passed in.
 *
 * For performance and long term maintainability, we want to switch as much of
 * the Courseware MFE to use the Learning Sequences API as possible, and
 * eventually remove calls to the Course Blocks API. However, right now, certain
 * data still has to come form the Course Blocks API. This function is a
 * transitional step to help build out some of the data from the new API, while
 * falling back to the Course Blocks API for other things.
 *
 * Overall performance gains will not be realized until we completely remove
 * this call to the Course Blocks API (and the need for this function).
 *
 * @param {*} learningSequencesModels  Normalized model from normalizeLearningSequencesData
 * @param {*} courseBlocksModels       Normalized model from normalizeBlocks
 * @param {bool} isMasquerading        Is Masquerading being used?
 */
function mergeLearningSequencesWithCourseBlocks(learningSequencesModels, courseBlocksModels, isMasquerading) {
  // If there's no Learning Sequences API data yet (not active for this course),
  // send back the course blocks model as-is. Likewise, Learning Sequences
  // doesn't currently handle masquerading properly for content groups.
  if (isMasquerading || learningSequencesModels === null) {
    return courseBlocksModels;
  }
  const mergedModels = {
    courses: {},
    sections: {},
    sequences: {},

    // Units are now copied over verbatim from Course Blocks API, but they
    // should eventually come just-in-time, once the Sequence Metadata API is
    // made to be acceptably fast.
    units: courseBlocksModels.units,
  };

  // Top level course information
  //
  // It is not at all clear to me why courses is a dict when there's only ever
  // one course, but I'm not going to make that model change right now.
  const lsCourse = Object.values(learningSequencesModels.courses)[0];
  const [courseBlockId, courseBlock] = Object.entries(courseBlocksModels.courses)[0];

  // The Learning Sequences API never exposes the usage key of the root course
  // block, which is used as the key here (instead of the CourseKey). It doesn't
  // look like anything actually queries for this value though, and even the
  // courseBlocksModels.courses uses the CourseKey as the "id" in the value. So
  // I'm imitating the form here to minimize the chance of things breaking, but
  // I think we should just forget the keys and replace courses with a singular
  // course. I might end up doing that before my refactoring is done here. >_<
  mergedModels.courses[courseBlockId] = {
    // Learning Sequences API Data
    id: lsCourse.id,
    title: lsCourse.title,
    sectionIds: lsCourse.sectionIds,
    hasScheduledContent: lsCourse.hasScheduledContent,

    // Still pulling from Course Blocks API
    effortActivities: courseBlock.effortActivities,
    effortTime: courseBlock.effortTime,
  };

  // List of Sequences comes from Learning Sequences. Course Blocks will have
  // extra sequences that we don't want to display to the user, like ones that
  // are empty because all the enclosed units are in user partition groups that
  // the user is not a part of (e.g. Verified Track).
  Object.entries(learningSequencesModels.sequences).forEach(([sequenceId, sequence]) => {
    const blocksSequence = courseBlocksModels.sequences[sequenceId];
    mergedModels.sequences[sequenceId] = {
      // Learning Sequences API Data
      id: sequenceId,
      title: sequence.title,

      // Still pulling from Course Blocks API Data:
      effortActivities: blocksSequence.effortActivities,
      effortTime: blocksSequence.effortTime,
      legacyWebUrl: blocksSequence.legacyWebUrl,
      hash_key: blocksSequence.hash_key,
      unitIds: blocksSequence.unitIds,
    };

    // Add back-references to this sequence for all child units.
    blocksSequence.unitIds.forEach(childUnitId => {
      mergedModels.units[childUnitId].sequenceId = sequenceId;
    });
  });

  // List of Sections comes from Learning Sequences.
  Object.entries(learningSequencesModels.sections).forEach(([sectionId, section]) => {
    const blocksSection = courseBlocksModels.sections[sectionId];
    mergedModels.sections[sectionId] = {
      // Learning Sequences API Data
      id: sectionId,
      title: section.title,
      sequenceIds: section.sequenceIds,
      courseId: lsCourse.id,

      // Still pulling from Course Blocks API Data:
      effortActivities: blocksSection.effortActivities,
      effortTime: blocksSection.effortTime,
    };
    // Add back-references to this section for all child sequences.
    section.sequenceIds.forEach(childSeqId => {
      mergedModels.sequences[childSeqId].sectionId = sectionId;
    });
  });

  return mergedModels;
}

export function fetchCourse(courseId) {
  return async (dispatch) => {
    dispatch(fetchCourseRequest({ courseId }));
    Promise.allSettled([
      getCourseMetadata(courseId),
      getCourseBlocks(courseId),
      getLearningSequencesOutline(courseId),
    ]).then(([courseMetadataResult, courseBlocksResult, learningSequencesOutlineResult]) => {
      if (courseMetadataResult.status === 'fulfilled') {
        dispatch(addModel({
          modelType: 'coursewareMeta',
          model: courseMetadataResult.value,
        }));
        dispatch(setsSpecialExamsEnabled({
          specialExamsEnabledWaffleFlag: courseMetadataResult.value.specialExamsEnabledWaffleFlag,
        }));
        dispatch(setsProctoredExamsEnabled({
          proctoredExamsEnabledWaffleFlag: courseMetadataResult.value.proctoredExamsEnabledWaffleFlag,
        }));
        dispatch(setsShortLinkFeatureFlag({
          shortLinkFeatureFlag: courseMetadataResult.value.shortLinkFeatureFlag,
        }));
      }

      if (courseBlocksResult.status === 'fulfilled') {
        const {
          courses, sections, sequences, units,
        } = mergeLearningSequencesWithCourseBlocks(
          learningSequencesOutlineResult.value,
          courseBlocksResult.value,
          courseMetadataResult.value.isMasquerading,
        );

        // This updates the course with a sectionIds array from the blocks data.
        dispatch(updateModelsMap({
          modelType: 'coursewareMeta',
          modelsMap: courses,
        }));
        dispatch(addModelsMap({
          modelType: 'sections',
          modelsMap: sections,
        }));
        // We update for sequences and units because the sequence metadata may have come back first.
        dispatch(updateModelsMap({
          modelType: 'sequences',
          modelsMap: sequences,
        }));
        dispatch(addModelsMap({
          modelType: 'sequenceIdToHashKeyMap',
          modelsMap: sequences,
        }));
        dispatch(updateModelsMap({
          modelType: 'units',
          modelsMap: units,
        }));
        dispatch(addModelsMap({
          modelType: 'unitIdToHashKeyMap',
          modelsMap: units,
        }));
      }

      const fetchedMetadata = courseMetadataResult.status === 'fulfilled';
      const fetchedBlocks = courseBlocksResult.status === 'fulfilled';

      // Log errors for each request if needed. Course block failures may occur
      // even if the course metadata request is successful
      if (!fetchedBlocks) {
        const { response } = courseBlocksResult.reason;
        if (response && response.status === 403) {
          // 403 responses are normal - they happen when the learner is logged out.
          // We'll redirect them in a moment to the outline tab by calling fetchCourseDenied() below.
          logInfo(courseBlocksResult.reason);
        } else {
          logError(courseBlocksResult.reason);
        }
      }
      if (!fetchedMetadata) {
        logError(courseMetadataResult.reason);
      }

      if (fetchedMetadata) {
        if (courseMetadataResult.value.courseAccess.hasAccess && fetchedBlocks) {
          // User has access
          dispatch(fetchCourseSuccess({ courseId }));
          return;
        }
        // User either doesn't have access or only has partial access
        // (can't access course blocks)
        dispatch(fetchCourseDenied({ courseId }));
        return;
      }

      // Definitely an error happening
      dispatch(fetchCourseFailure({ courseId }));
    });
  };
}

export function fetchSequence(sequenceId) {
  return async (dispatch) => {
    dispatch(fetchSequenceRequest({ sequenceId }));
    try {
      const { sequence, units } = await getSequenceMetadata(sequenceId);
      if (sequence.blockType !== 'sequential') {
        // Some other block types (particularly 'chapter') can be returned
        // by this API. We want to error in that case, since downstream
        // courseware code is written to render Sequences of Units.
        logError(
          `Requested sequence '${sequenceId}' `
          + `has block type '${sequence.blockType}'; expected block type 'sequential'.`,
        );
        dispatch(fetchSequenceFailure({ sequenceId }));
      } else {
        dispatch(updateModel({
          modelType: 'sequences',
          model: sequence,
        }));
        dispatch(updateModel({
          modelType: 'sequenceIdToHashKeyMap',
          model: sequence,
        }));
        dispatch(updateModels({
          modelType: 'units',
          models: units,
        }));
        dispatch(updateModels({
          modelType: 'unitIdToHashKeyMap',
          models: units,
        }));
        dispatch(fetchSequenceSuccess({ sequenceId }));
      }
    } catch (error) {
      logError(error);
      dispatch(fetchSequenceFailure({ sequenceId }));
    }
  };
}

export function checkBlockCompletion(courseId, sequenceId, unitId) {
  return async (dispatch, getState) => {
    const { models } = getState();
    let modelsUnitId = unitId;
    let modelsSequenceId = sequenceId;
    if (!models.units[unitId]) {
      modelsUnitId = models.unitIdToHashKeyMap[unitId];
    }
    if (!models.sequences[sequenceId]) {
      modelsSequenceId = models.sequenceIdToHashKeyMap[sequenceId];
    }
    if (models.units[modelsUnitId].complete) {
      return; // do nothing. Things don't get uncompleted after they are completed.
    }

    try {
      const isComplete = await getBlockCompletion(courseId, modelsSequenceId, modelsUnitId);
      dispatch(updateModel({
        modelType: 'units',
        model: {
          id: modelsUnitId,
          complete: isComplete,
        },
      }));
    } catch (error) {
      logError(error);
    }
  };
}

export function saveSequencePosition(courseId, sequenceId, activeUnitIndex) {
  return async (dispatch, getState) => {
    const { models } = getState();
    let modelsSequenceId = sequenceId;
    if (!models.sequences[sequenceId]) {
      modelsSequenceId = models.sequenceIdToHashKeyMap[sequenceId];
    }
    const initialActiveUnitIndex = models.sequences[modelsSequenceId].activeUnitIndex;
    // Optimistically update the position.
    dispatch(updateModel({
      modelType: 'sequences',
      model: {
        id: modelsSequenceId,
        activeUnitIndex,
      },
    }));
    try {
      await postSequencePosition(courseId, modelsSequenceId, activeUnitIndex);
      // Update again under the assumption that the above call succeeded, since it doesn't return a
      // meaningful response.
      dispatch(updateModel({
        modelType: 'sequences',
        model: {
          id: modelsSequenceId,
          activeUnitIndex,
        },
      }));
    } catch (error) {
      logError(error);
      dispatch(updateModel({
        modelType: 'sequences',
        model: {
          id: modelsSequenceId,
          activeUnitIndex: initialActiveUnitIndex,
        },
      }));
    }
  };
}

export function saveIntegritySignature(courseId) {
  return async (dispatch) => {
    try {
      await postIntegritySignature(courseId);
      dispatch(updateModel({
        modelType: 'coursewareMeta',
        model: {
          id: courseId,
          userNeedsIntegritySignature: false,
        },
      }));
    } catch (error) {
      logError(error);
    }
  };
}

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { history } from '@edx/frontend-platform';
import { createSelector } from '@reduxjs/toolkit';
import { defaultMemoize as memoize } from 'reselect';

import {
  checkBlockCompletion,
  fetchCourse,
  fetchSequence,
  getResumeBlock,
  saveSequencePosition,
} from './data';
import { TabPage } from '../tab-page';

import Course from './course';
import { handleNextSectionCelebration } from './course/celebration';

const checkUrlLength = memoize((shortLinkFeatureFlag, courseStatus, courseId, sequence, unitHashKey) => {
  if (shortLinkFeatureFlag && courseStatus === 'loaded' && sequence && unitHashKey) {
    history.replace(`/c/${courseId}/${sequence.hash_key}/${unitHashKey}`);
  }
});

const checkResumeRedirect = memoize((courseStatus, courseId, sequenceId, firstSequenceId) => {
  if (courseStatus === 'loaded' && !sequenceId) {
    // Note that getResumeBlock is just an API call, not a redux thunk.
    getResumeBlock(courseId).then((data) => {
      // This is a replace because we don't want this change saved in the browser's history.
      if (data.sectionId && data.unitId) {
        history.replace(`/c/${courseId}/${data.sectionId}/${data.unitId}`);
      } else if (firstSequenceId) {
        history.replace(`/c/${courseId}/${firstSequenceId}`);
      }
    });
  }
});

const checkSectionUnitToUnitRedirect = memoize((courseStatus, courseId, sequenceStatus, section, unitId) => {
  if (courseStatus === 'loaded' && sequenceStatus === 'failed' && section && unitId) {
    history.replace(`/c/${courseId}/${unitId}`);
  }
});

const checkSectionToSequenceRedirect = memoize((courseStatus, courseId, sequenceStatus, section, unitId) => {
  if (courseStatus === 'loaded' && sequenceStatus === 'failed' && section && !unitId) {
    // If the section is non-empty, redirect to its first sequence.
    if (section.sequenceIds && section.sequenceIds[0]) {
      history.replace(`/c/${courseId}/${section.sequenceIds[0]}`);
    // Otherwise, just go to the course root, letting the resume redirect take care of things.
    } else {
      history.replace(`/c/${courseId}`);
    }
  }
});

const checkUnitToSequenceUnitRedirect = memoize((courseStatus, courseId, sequenceStatus, unit) => {
  if (courseStatus === 'loaded' && sequenceStatus === 'failed' && unit) {
    // If the sequence failed to load as a sequence, but it *did* load as a unit, then
    // insert the unit's parent sequenceId into the URL.
    history.replace(`/c/${courseId}/${unit.sequenceId}/${unit.id}`);
  }
});

const checkSpecialExamRedirect = memoize((sequenceStatus, sequence, specialExamsEnabled, proctoredExamsEnabled) => {
  if (sequenceStatus === 'loaded') {
    const shouldRedirectTimeLimited = sequence.isTimeLimited && !specialExamsEnabled;
    const shouldRedirectProctored = sequence.isProctored && !proctoredExamsEnabled;
    if ((shouldRedirectTimeLimited || shouldRedirectProctored) && sequence.legacyWebUrl !== undefined) {
      global.location.assign(sequence.legacyWebUrl);
    }
  }
});

const checkSequenceToSequenceUnitRedirect = memoize((courseId, sequenceStatus, sequence, unitId) => {
  if (sequenceStatus === 'loaded' && sequence.id && !unitId) {
    if (sequence.unitIds !== undefined && sequence.unitIds.length > 0) {
      const nextUnitId = sequence.unitIds[sequence.activeUnitIndex];
      // This is a replace because we don't want this change saved in the browser's history.
      history.replace(`/c/${courseId}/${sequence.id}/${nextUnitId}`);
    }
  }
});

class CoursewareContainer extends Component {
  checkSaveSequencePosition = memoize((unitId) => {
    const {
      courseId,
      sequenceId,
      sequenceStatus,
      sequence,
    } = this.props;
    if (sequenceStatus === 'loaded' && sequence.saveUnitPosition && unitId) {
      const activeUnitIndex = sequence.unitIds.indexOf(unitId);
      this.props.saveSequencePosition(courseId, sequenceId, activeUnitIndex);
    }
  });

  checkFetchCourse = memoize((courseId) => {
    this.props.fetchCourse(courseId);
  });

  checkFetchSequence = memoize((sequenceId) => {
    if (sequenceId) {
      this.props.fetchSequence(sequenceId);
    }
  });

  componentDidMount() {
    const {
      match: {
        params: {
          courseId: routeCourseId,
          sequenceId: routeSequenceHash,
        },
      },
    } = this.props;
    // Load data whenever the course or sequence ID changes.
    this.checkFetchCourse(routeCourseId);
    this.checkFetchSequence(routeSequenceHash);
  }

  componentDidUpdate() {
    const {
      courseId,
      sequenceId,
      courseStatus,
      sequenceStatus,
      specialExamsEnabledWaffleFlag,
      proctoredExamsEnabledWaffleFlag,
      sequence,
      firstSequenceId,
      unitViaSequenceId,
      sectionViaSequenceId,
      unitIdHashKeyMap,
      shortLinkFeatureFlag,
      match: {
        params: {
          courseId: routeCourseId,
          sequenceId: routeSequenceHash,
          unitId: routeUnitId,
        },
      },
    } = this.props;
    // Load data whenever the course or sequence ID changes.
    this.checkFetchCourse(routeCourseId);
    this.checkFetchSequence(routeSequenceHash);
    if (sequence && routeSequenceHash.includes('block') && unitIdHashKeyMap) {
      let unitHashKey;
      Object.values(unitIdHashKeyMap).forEach(id => {
        if (id === routeUnitId) {
          unitHashKey = Object.keys(unitIdHashKeyMap).find(key => unitIdHashKeyMap[key] === id);
        }
      });
      checkUrlLength(shortLinkFeatureFlag, courseStatus, courseId, sequence, unitHashKey);
    }

    // All courseware URLs should normalize to the format /course/:courseId/:sequenceId/:unitId
    // via the series of redirection rules below.
    // See docs/decisions/0008-liberal-courseware-path-handling.md for more context.
    // (It would be ideal to move this logic into the thunks layer and perform
    //  all URL-changing checks at once. This should be done once the MFE is moved
    //  to the new Outlines API. See TNL-8182.)

    // Check resume redirect:
    //   /course/:courseId -> /course/:courseId/:sequenceId/:unitId
    // based on sequence/unit where user was last active.
    checkResumeRedirect(courseStatus, courseId, sequenceId, firstSequenceId);

    // Check section-unit to unit redirect:
    //    /course/:courseId/:sectionId/:unitId -> /course/:courseId/:unitId
    // by simply ignoring the :sectionId.
    // (It may be desirable at some point to be smarter here; for example, we could replace
    //  :sectionId with the parent sequence of :unitId and/or check whether the :unitId
    //  is actually within :sectionId. However, the way our Redux store is currently factored,
    //  the unit's metadata is not available to us if the section isn't loadable.)
    // Before performing this redirect, we *do* still check that a section is loadable;
    // otherwise, we could get stuck in a redirect loop, since a sequence that failed to load
    // would endlessly redirect to itself through `checkSectionUnitToUnitRedirect`
    // and `checkUnitToSequenceUnitRedirect`.
    checkSectionUnitToUnitRedirect(courseStatus, courseId, sequenceStatus, sectionViaSequenceId, routeUnitId);

    // Check section to sequence redirect:
    //    /course/:courseId/:sectionId         -> /course/:courseId/:sequenceId
    // by redirecting to the first sequence within the section.
    checkSectionToSequenceRedirect(courseStatus, courseId, sequenceStatus, sectionViaSequenceId, routeUnitId);

    // Check unit to sequence-unit redirect:
    //    /course/:courseId/:unitId -> /course/:courseId/:sequenceId/:unitId
    // by filling in the ID of the parent sequence of :unitId.
    checkUnitToSequenceUnitRedirect(courseStatus, courseId, sequenceStatus, unitViaSequenceId);

    // Check special exam redirect:
    //    /course/:courseId/:sequenceId(/:unitId) -> :legacyWebUrl
    // because special exams are currently still served in the legacy LMS frontend.
    checkSpecialExamRedirect(sequenceStatus, sequence, specialExamsEnabledWaffleFlag, proctoredExamsEnabledWaffleFlag);

    // Check to sequence to sequence-unit redirect:
    //    /course/:courseId/:sequenceId -> /course/:courseId/:sequenceId/:unitId
    // by filling in the ID the most-recently-active unit in the sequence, OR
    // the ID of the first unit the sequence if none is active.
    checkSequenceToSequenceUnitRedirect(courseId, sequenceStatus, sequence, routeUnitId);

    // Check if we should save our sequence position.  Only do this when the route unit ID changes.
    this.checkSaveSequencePosition(routeUnitId);
  }

  handleUnitNavigationClick = (nextUnitId) => {
    const {
      courseId, sequenceId,
      match: {
        params: {
          unitId: routeUnitId,
        },
      },
    } = this.props;

    this.props.checkBlockCompletion(courseId, sequenceId, routeUnitId);
    history.push(`/c/${courseId}/${sequenceId}/${nextUnitId}`);
  }

  handleNextSequenceClick = () => {
    const {
      course,
      courseId,
      nextSequence,
      sequence,
      sequenceId,
      shortLinkFeatureFlag,
    } = this.props;
    if (nextSequence !== null) {
      let nextSequenceParam = nextSequence.id;
      if (shortLinkFeatureFlag) {
        nextSequenceParam = nextSequence.hash_key;
      }
      let nextUnitId = null;
      if (nextSequence.unitIds.length > 0) {
        [nextUnitId] = nextSequence.unitIds;
        history.push(`/c/${courseId}/${nextSequenceParam}/${nextUnitId}`);
      } else {
        // Some sequences have no units.  This will show a blank page with prev/next buttons.
        history.push(`/c/${courseId}/${nextSequenceParam}`);
      }

      const celebrateFirstSection = course && course.celebrations && course.celebrations.firstSection;
      if (celebrateFirstSection && sequence.sectionId !== nextSequence.sectionId) {
        handleNextSectionCelebration(sequenceId, nextSequence.id, nextUnitId);
      }
    }
  }

  handlePreviousSequenceClick = () => {
    const {
      previousSequence,
      courseId,
      shortLinkFeatureFlag,
    } = this.props;
    if (previousSequence !== null) {
      let previousSequenceParam = previousSequence.id;
      if (shortLinkFeatureFlag) {
        previousSequenceParam = previousSequence.hash_key;
      }
      if (previousSequence.unitIds.length > 0) {
        const previousUnitId = previousSequence.unitIds[previousSequence.unitIds.length - 1];
        history.push(`/c/${courseId}/${previousSequenceParam}/${previousUnitId}`);
      } else {
        // Some sequences have no units.  This will show a blank page with prev/next buttons.
        history.push(`/c/${courseId}/${previousSequenceParam}`);
      }
    }
  }

  render() {
    const {
      courseStatus,
      courseId,
      sequenceId,
      sequence,
      shortLinkFeatureFlag,
      unitIdHashKeyMap,
      match: {
        params: {
          unitId: routeUnitId,
        },
      },
    } = this.props;

    // This helps process old URLS that still use a blocks usage key in the URL.
    let updatedSequenceId;
    let updatedUnitId;
    if (shortLinkFeatureFlag && sequence) {
      if (!sequenceId.includes('block')) {
        updatedSequenceId = sequence.id;
      }
      if (routeUnitId && !routeUnitId.includes('block')) {
        updatedUnitId = unitIdHashKeyMap[routeUnitId];
      }
    }

    return (
      <TabPage
        activeTabSlug="courseware"
        courseId={courseId}
        unitId={updatedUnitId || routeUnitId}
        courseStatus={courseStatus}
        metadataModel="coursewareMeta"
      >
        <Course
          courseId={courseId}
          sequenceId={updatedSequenceId || sequenceId}
          unitId={updatedUnitId || routeUnitId}
          nextSequenceHandler={this.handleNextSequenceClick}
          previousSequenceHandler={this.handlePreviousSequenceClick}
          unitNavigationHandler={this.handleUnitNavigationClick}
        />
      </TabPage>
    );
  }
}

const unitShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  sequenceId: PropTypes.string.isRequired,
});

const sequenceShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  unitIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  sectionId: PropTypes.string.isRequired,
  hash_key: PropTypes.string.isRequired,
  isTimeLimited: PropTypes.bool,
  isProctored: PropTypes.bool,
  legacyWebUrl: PropTypes.string,
});

const sectionShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  sequenceIds: PropTypes.arrayOf(PropTypes.string).isRequired,
});

const courseShape = PropTypes.shape({
  celebrations: PropTypes.shape({
    firstSection: PropTypes.bool,
  }),
});

CoursewareContainer.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      courseId: PropTypes.string.isRequired,
      sequenceId: PropTypes.string,
      unitId: PropTypes.string,
    }).isRequired,
  }).isRequired,
  courseId: PropTypes.string,
  sequenceId: PropTypes.string,
  firstSequenceId: PropTypes.string,
  courseStatus: PropTypes.oneOf(['loaded', 'loading', 'failed', 'denied']).isRequired,
  sequenceStatus: PropTypes.oneOf(['loaded', 'loading', 'failed']).isRequired,
  nextSequence: sequenceShape,
  previousSequence: sequenceShape,
  unitViaSequenceId: unitShape,
  sectionViaSequenceId: sectionShape,
  unitIdHashKeyMap: unitShape,
  course: courseShape,
  sequence: sequenceShape,
  saveSequencePosition: PropTypes.func.isRequired,
  checkBlockCompletion: PropTypes.func.isRequired,
  fetchCourse: PropTypes.func.isRequired,
  fetchSequence: PropTypes.func.isRequired,
  specialExamsEnabledWaffleFlag: PropTypes.bool.isRequired,
  proctoredExamsEnabledWaffleFlag: PropTypes.bool.isRequired,
  shortLinkFeatureFlag: PropTypes.bool.isRequired,
};

CoursewareContainer.defaultProps = {
  courseId: null,
  sequenceId: null,
  firstSequenceId: null,
  nextSequence: null,
  previousSequence: null,
  unitViaSequenceId: null,
  sectionViaSequenceId: null,
  course: null,
  sequence: null,
  unitIdHashKeyMap: null,
};

const currentCourseSelector = createSelector(
  (state) => state.models.coursewareMeta || {},
  (state) => state.courseware.courseId,
  (coursesById, courseId) => (coursesById[courseId] ? coursesById[courseId] : null),
);

const currentSequenceSelector = createSelector(
  (state) => state.models.sequences || {},
  (state) => state.courseware.sequenceId,
  (state) => state.models.sequenceIdToHashKeyMap,
  (sequencesById, sequenceId, sequenceMap) => {
    if (!sequencesById[sequenceId] && Object.keys(sequencesById).length > 0 && sequenceMap) {
      if (sequenceId in sequenceMap) {
        const updatedSequenceId = sequenceMap[sequenceId];
        return sequencesById[updatedSequenceId];
      }
    }
    return sequencesById[sequenceId] ? sequencesById[sequenceId] : null;
  },
);

const sequenceIdsSelector = createSelector(
  (state) => state.courseware.courseStatus,
  currentCourseSelector,
  (state) => state.models.sections,
  (courseStatus, course, sectionsById) => {
    if (courseStatus !== 'loaded') {
      return [];
    }
    const { sectionIds = [] } = course;
    return sectionIds.flatMap(sectionId => sectionsById[sectionId].sequenceIds);
  },
);

const previousSequenceSelector = createSelector(
  sequenceIdsSelector,
  (state) => state.models.sequences || {},
  (state) => state.courseware.sequenceId,
  (state) => state.models.sequenceIdToHashKeyMap,
  (sequenceIds, sequencesById, sequenceId, sequenceMap) => {
    if (!sequenceId || sequenceIds.length === 0) {
      return null;
    }
    let sequenceIndex = sequenceIds.indexOf(sequenceId);
    if (!sequencesById[sequenceId] && Object.keys(sequencesById).length > 0 && sequenceMap) {
      if (sequenceId in sequenceMap) {
        const updatedSequenceId = sequenceMap[sequenceId];
        sequenceIndex = sequenceIds.indexOf(updatedSequenceId);
      }
    }
    const previousSequenceId = sequenceIndex > 0 ? sequenceIds[sequenceIndex - 1] : null;
    return previousSequenceId !== null ? sequencesById[previousSequenceId] : null;
  },
);

const nextSequenceSelector = createSelector(
  sequenceIdsSelector,
  (state) => state.models.sequences || {},
  (state) => state.courseware.sequenceId,
  (state) => state.models.sequenceIdToHashKeyMap,
  (sequenceIds, sequencesById, sequenceId, sequenceMap) => {
    if (!sequenceId || sequenceIds.length === 0) {
      return null;
    }
    let sequenceIndex = sequenceIds.indexOf(sequenceId);
    if (!sequencesById[sequenceId] && Object.keys(sequencesById).length > 0 && sequenceMap) {
      if (sequenceId in sequenceMap) {
        const updatedSequenceId = sequenceMap[sequenceId];
        sequenceIndex = sequenceIds.indexOf(updatedSequenceId);
      }
    }
    const nextSequenceId = sequenceIndex < sequenceIds.length - 1 ? sequenceIds[sequenceIndex + 1] : null;
    return nextSequenceId !== null ? sequencesById[nextSequenceId] : null;
  },
);

const firstSequenceIdSelector = createSelector(
  (state) => state.courseware.courseStatus,
  currentCourseSelector,
  (state) => state.models.sections || {},
  (courseStatus, course, sectionsById) => {
    if (courseStatus !== 'loaded') {
      return null;
    }
    const { sectionIds = [] } = course;

    if (sectionIds.length === 0) {
      return null;
    }

    return sectionsById[sectionIds[0]].sequenceIds[0];
  },
);

const sectionViaSequenceIdSelector = createSelector(
  (state) => state.models.sections || {},
  (state) => state.courseware.sequenceId,
  (sectionsById, sequenceId) => (sectionsById[sequenceId] ? sectionsById[sequenceId] : null),
);

const unitViaSequenceIdSelector = createSelector(
  (state) => state.models.units || {},
  (state) => state.courseware.sequenceId,
  (state) => state.models.unitIdHashKeyMap,
  (unitsById, sequenceId, unitMap) => {
    if (!unitsById[sequenceId] && Object.keys(unitsById).length > 0 && unitMap) {
      if (sequenceId in unitMap) {
        const updatedSequenceId = unitMap[sequenceId];
        return unitsById[updatedSequenceId];
      }
    }
    return unitsById[sequenceId] ? unitsById[sequenceId] : null;
  },
);

const unitIdHashKeyMapSelector = createSelector(
  (state) => state.models.unitIdToHashKeyMap,
  (unitIdToHashKeyMap) => (unitIdToHashKeyMap),
);

const mapStateToProps = (state) => {
  const {
    courseId,
    sequenceId,
    courseStatus,
    sequenceStatus,
    specialExamsEnabledWaffleFlag,
    proctoredExamsEnabledWaffleFlag,
    shortLinkFeatureFlag,
  } = state.courseware;

  return {
    courseId,
    sequenceId,
    courseStatus,
    sequenceStatus,
    specialExamsEnabledWaffleFlag,
    proctoredExamsEnabledWaffleFlag,
    shortLinkFeatureFlag,
    course: currentCourseSelector(state),
    sequence: currentSequenceSelector(state),
    previousSequence: previousSequenceSelector(state),
    nextSequence: nextSequenceSelector(state),
    firstSequenceId: firstSequenceIdSelector(state),
    sectionViaSequenceId: sectionViaSequenceIdSelector(state),
    unitViaSequenceId: unitViaSequenceIdSelector(state),
    unitIdHashKeyMap: unitIdHashKeyMapSelector(state),
  };
};

export default connect(mapStateToProps, {
  checkBlockCompletion,
  saveSequencePosition,
  fetchCourse,
  fetchSequence,
})(CoursewareContainer);

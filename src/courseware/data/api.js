import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { logInfo } from '@edx/frontend-platform/logging';
import { getTimeOffsetMillis } from '../../course-home/data/api';
import { appendBrowserTimezoneToUrl } from '../../utils';

export function normalizeBlocks(courseId, blocks) {
  const models = {
    courses: {},
    sections: {},
    sequences: {},
    units: {},
  };

  Object.values(blocks).forEach(block => {
    switch (block.type) {
      case 'course':
        models.courses[block.id] = {
          id: courseId,
          title: block.display_name,
          sectionIds: block.children || [],
          hasScheduledContent: block.has_scheduled_content || false,
        };
        break;
      case 'chapter':
        models.sections[block.id] = {
          id: block.id,
          title: block.display_name,
          sequenceIds: block.children || [],
        };
        break;

      case 'sequential':
        models.sequences[block.id] = {
          effortActivities: block.effort_activities,
          effortTime: block.effort_time,
          id: block.id,
          title: block.display_name,
          legacyWebUrl: block.legacy_web_url,
          unitIds: block.children || [],
          hash_key: block.hash_key,
        };
        break;
      case 'vertical':
        models.units[block.id] = {
          graded: block.graded,
          id: block.id,
          title: block.display_name,
          legacyWebUrl: block.legacy_web_url,
          hash_key: block.hash_key,
        };
        break;
      default:
        logInfo(`Unexpected course block type: ${block.type} with ID ${block.id}.  Expected block types are course, chapter, sequential, and vertical.`);
    }
  });

  // Next go through each list and use their child lists to decorate those children with a
  // reference back to their parent.
  Object.values(models.courses).forEach(course => {
    if (Array.isArray(course.sectionIds)) {
      course.sectionIds.forEach(sectionId => {
        const section = models.sections[sectionId];
        section.courseId = course.id;
      });
    }
  });

  Object.values(models.sections).forEach(section => {
    if (Array.isArray(section.sequenceIds)) {
      section.sequenceIds.forEach(sequenceId => {
        if (sequenceId in models.sequences) {
          models.sequences[sequenceId].sectionId = section.id;
        } else {
          logInfo(`Section ${section.id} has child block ${sequenceId}, but that block is not in the list of sequences.`);
        }
      });
    }
  });

  Object.values(models.sequences).forEach(sequence => {
    if (Array.isArray(sequence.unitIds)) {
      sequence.unitIds.forEach(unitId => {
        if (unitId in models.units) {
          models.units[unitId].sequenceId = sequence.id;
        } else {
          logInfo(`Sequence ${sequence.id} has child block ${unitId}, but that block is not in the list of units.`);
        }
      });
    }
  });
  return models;
}

export function normalizeLearningSequencesData(learningSequencesData) {
  const models = {
    courses: {},
    sections: {},
    sequences: {},
  };

  // Course
  const now = new Date();
  models.courses[learningSequencesData.course_key] = {
    id: learningSequencesData.course_key,
    title: learningSequencesData.title,
    sectionIds: learningSequencesData.outline.sections.map(section => section.id),

    // Scan through all the sequences and look for ones that aren't accessible
    // to us yet because the start date has not yet passed. (Some may be
    // inaccessible because the end_date has passed.)
    hasScheduledContent: Object.values(learningSequencesData.outline.sequences).some(
      seq => !seq.accessible && now < Date.parse(seq.effective_start),
    ),
  };

  // Sections
  learningSequencesData.outline.sections.forEach(section => {
    models.sections[section.id] = {
      id: section.id,
      title: section.title,
      sequenceIds: section.sequence_ids,
    };
  });

  // Sequences
  Object.entries(learningSequencesData.outline.sequences).forEach(([seqId, sequence]) => {
    models.sequences[seqId] = {
      id: seqId,
      title: sequence.title,
    };
  });

  return models;
}

export async function getCourseBlocks(courseId) {
  const authenticatedUser = getAuthenticatedUser();
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/`);
  url.searchParams.append('course_id', courseId);
  url.searchParams.append('username', authenticatedUser ? authenticatedUser.username : '');
  url.searchParams.append('depth', 3);
  url.searchParams.append('requested_fields', 'children,effort_activities,effort_time,show_gated_sections,graded,special_exam_info,has_scheduled_content');

  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  return normalizeBlocks(courseId, data.blocks);
}

// Returns the output of the Learning Sequences API, or null if that API is not
// currently available for this user in this course.
export async function getLearningSequencesOutline(courseId) {
  const outlineUrl = new URL(`${getConfig().LMS_BASE_URL}/api/learning_sequences/v1/course_outline/${courseId}`);

  try {
    const { data } = await getAuthenticatedHttpClient().get(outlineUrl.href, {});
    return normalizeLearningSequencesData(data);
  } catch (error) {
    // This is not a critical API to use at the moment. If it errors for any
    // reason, just send back a null so the higher layers know to ignore it.
    if (error.response) {
      if (error.response.status === 403) {
        logInfo('Learning Sequences API not enabled for this user.');
      } else {
        logInfo(`Unexpected error calling Learning Sequences API (${error.response.status}). Ignoring.`);
      }
      return null;
    }
    throw error;
  }
}

function normalizeTabUrls(id, tabs) {
  // If api doesn't return the mfe base url, change tab url to point back to LMS
  return tabs.map((tab) => {
    let { url } = tab;
    if (url[0] === '/') {
      url = `${getConfig().LMS_BASE_URL}${tab.url}`;
    }
    return { ...tab, url };
  });
}

function normalizeMetadata(metadata) {
  const requestTime = Date.now();
  const responseTime = requestTime;
  const { data, headers } = metadata;
  return {
    accessExpiration: camelCaseObject(data.access_expiration),
    canShowUpgradeSock: data.can_show_upgrade_sock,
    contentTypeGatingEnabled: data.content_type_gating_enabled,
    id: data.id,
    title: data.name,
    number: data.number,
    offer: camelCaseObject(data.offer),
    org: data.org,
    enrollmentStart: data.enrollment_start,
    enrollmentEnd: data.enrollment_end,
    end: data.end,
    start: data.start,
    enrollmentMode: data.enrollment.mode,
    isEnrolled: data.enrollment.is_active,
    courseAccess: camelCaseObject(data.course_access),
    canViewLegacyCourseware: data.can_view_legacy_courseware,
    originalUserIsStaff: data.original_user_is_staff,
    isStaff: data.is_staff,
    license: data.license,
    verifiedMode: camelCaseObject(data.verified_mode),
    tabs: normalizeTabUrls(data.id, camelCaseObject(data.tabs)),
    userTimezone: data.user_timezone,
    showCalculator: data.show_calculator,
    notes: camelCaseObject(data.notes),
    marketingUrl: data.marketing_url,
    celebrations: camelCaseObject(data.celebrations),
    userHasPassingGrade: data.user_has_passing_grade,
    courseExitPageIsActive: data.course_exit_page_is_active,
    certificateData: camelCaseObject(data.certificate_data),
    timeOffsetMillis: getTimeOffsetMillis(headers && headers.date, requestTime, responseTime),
    verifyIdentityUrl: data.verify_identity_url,
    verificationStatus: data.verification_status,
    linkedinAddToProfileUrl: data.linkedin_add_to_profile_url,
    relatedPrograms: camelCaseObject(data.related_programs),
    userNeedsIntegritySignature: data.user_needs_integrity_signature,
    specialExamsEnabledWaffleFlag: data.is_mfe_special_exams_enabled,
    proctoredExamsEnabledWaffleFlag: data.is_mfe_proctored_exams_enabled,
    isMasquerading: data.original_user_is_staff && !data.is_staff,
    shortLinkFeatureFlag: data.mfe_short_url_is_active,
  };
}

export async function getCourseMetadata(courseId) {
  let url = `${getConfig().LMS_BASE_URL}/api/courseware/course/${courseId}`;
  url = appendBrowserTimezoneToUrl(url);
  const metadata = await getAuthenticatedHttpClient().get(url);
  return normalizeMetadata(metadata);
}

function normalizeSequenceMetadata(sequence) {
  return {
    sequence: {
      id: sequence.item_id,
      blockType: sequence.tag,
      unitIds: sequence.items.map(unit => unit.id),
      bannerText: sequence.banner_text,
      format: sequence.format,
      title: sequence.display_name,
      /*
      Example structure of gated_content when prerequisites exist:
      {
        prereq_id: 'id of the prereq section',
        prereq_url: 'unused by this frontend',
        prereq_section_name: 'Name of the prerequisite section',
        gated: true,
        gated_section_name: 'Name of this gated section',
      */
      gatedContent: camelCaseObject(sequence.gated_content),
      isTimeLimited: sequence.is_time_limited,
      isProctored: sequence.is_proctored,
      isHiddenAfterDue: sequence.is_hidden_after_due,
      // Position comes back from the server 1-indexed. Adjust here.
      activeUnitIndex: sequence.position ? sequence.position - 1 : 0,
      saveUnitPosition: sequence.save_position,
      showCompletion: sequence.show_completion,
      allowProctoringOptOut: sequence.allow_proctoring_opt_out,
      hash_key: sequence.hash_key,
      decoded_id: sequence.decoded_id,
    },
    units: sequence.items.map(unit => ({
      id: unit.id,
      sequenceId: sequence.item_id,
      bookmarked: unit.bookmarked,
      complete: unit.complete,
      title: unit.page_title,
      contentType: unit.type,
      graded: unit.graded,
      containsContentTypeGatedContent: unit.contains_content_type_gated_content,
      decoded_id: unit.decoded_id,
      hash_key: unit.hash_key,
    })),
  };
}
export async function getSequenceMetadata(sequenceId) {
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceId}`, {});
  return normalizeSequenceMetadata(data);
}

const getSequenceHandlerUrl = (courseId, sequenceId) => `${getConfig().LMS_BASE_URL}/courses/${courseId}/xblock/${sequenceId}/handler`;

export async function getBlockCompletion(courseId, sequenceId, usageKey) {
  const { data } = await getAuthenticatedHttpClient().post(
    `${getSequenceHandlerUrl(courseId, sequenceId)}/get_completion`,
    { usage_key: usageKey },
  );
  return data.complete === true;
}

export async function postSequencePosition(courseId, sequenceId, activeUnitIndex) {
  const { data } = await getAuthenticatedHttpClient().post(
    `${getSequenceHandlerUrl(courseId, sequenceId)}/goto_position`,
    // Position is 1-indexed on the server and 0-indexed in this app. Adjust here.
    { position: activeUnitIndex + 1 },
  );
  return data;
}

export async function getResumeBlock(courseId) {
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courseware/resume/${courseId}`);
  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  return camelCaseObject(data);
}

export async function postIntegritySignature(courseId) {
  const { data } = await getAuthenticatedHttpClient().post(
    `${getConfig().LMS_BASE_URL}/api/agreements/v1/integrity_signature/${courseId}`, {},
  );
  return camelCaseObject(data);
}
export async function sendActivationEmail() {
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/send_account_activation_email`);
  const { data } = await getAuthenticatedHttpClient().post(url.href, {});
  return data;
}

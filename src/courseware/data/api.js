import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { getTimeOffsetMillis } from '../../course-home/data/api';
import { appendBrowserTimezoneToUrl } from '../../utils';

export function normalizeLearningSequencesData(learningSequencesData) {
  const models = {
    courses: {},
    sections: {},
    sequences: {},
  };

  // Sequences
  Object.entries(learningSequencesData.outline.sequences).forEach(([seqId, sequence]) => {
    if (!sequence.accessible) {
      // Skipping inaccessible sequences replicates the behavior of the legacy course blocks API
      return;
    }

    models.sequences[seqId] = {
      id: seqId,
      title: sequence.title,
      legacyWebUrl: `${getConfig().LMS_BASE_URL}/courses/${learningSequencesData.course_key}/jump_to/${seqId}?experience=legacy`,
    };
  });

  // Sections
  learningSequencesData.outline.sections.forEach(section => {
    // Skipping sections with only inaccessible sequences replicates the behavior of the legacy course blocks API
    // (But keep it if it was already empty, again to replicate legacy blocks API.)
    const accessibleSequenceIds = section.sequence_ids.filter(seqId => seqId in models.sequences);
    if (section.sequence_ids.length > 0 && accessibleSequenceIds.length === 0) {
      return;
    }

    models.sections[section.id] = {
      id: section.id,
      title: section.title,
      sequenceIds: accessibleSequenceIds,
      courseId: learningSequencesData.course_key,
    };

    // Add back-references to this section for all child sequences.
    accessibleSequenceIds.forEach(childSeqId => {
      models.sequences[childSeqId].sectionId = section.id;
    });
  });

  // Course
  const now = new Date();
  models.courses[learningSequencesData.course_key] = {
    id: learningSequencesData.course_key,
    title: learningSequencesData.title,
    sectionIds: Object.entries(models.sections).map(([sectionId]) => sectionId),

    // Scan through all the sequences and look for ones that aren't accessible
    // to us yet because the start date has not yet passed. (Some may be
    // inaccessible because the end_date has passed.)
    hasScheduledContent: Object.values(learningSequencesData.outline.sequences).some(
      seq => !seq.accessible && now < Date.parse(seq.effective_start),
    ),
  };

  return models;
}

// Do not add further calls to this API - we don't like making use of the modulestore if we can help it
export async function getSequenceForUnitDeprecated(courseId, unitId) {
  const authenticatedUser = getAuthenticatedUser();
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/`);
  url.searchParams.append('course_id', courseId);
  url.searchParams.append('username', authenticatedUser ? authenticatedUser.username : '');
  url.searchParams.append('depth', 3);
  url.searchParams.append('requested_fields', 'children');

  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  const parent = Object.values(data.blocks).find(block => block.type === 'sequential' && block.children.includes(unitId));
  return parent?.id;
}

export async function getLearningSequencesOutline(courseId) {
  const outlineUrl = new URL(`${getConfig().LMS_BASE_URL}/api/learning_sequences/v1/course_outline/${courseId}`);
  const { data } = await getAuthenticatedHttpClient().get(outlineUrl.href, {});
  return normalizeLearningSequencesData(data);
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
    courseGoals: camelCaseObject(data.course_goals),
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
    isIntegritySignatureEnabled: data.is_integrity_signature_enabled,
    userNeedsIntegritySignature: data.user_needs_integrity_signature,
    isMasquerading: data.original_user_is_staff && !data.is_staff,
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

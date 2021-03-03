import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

function filterRecommendationsList(
  {
    data: {
      uuid,
      recommendations,
    },
  },
  {
    data: enrollments,
  },
) {
  const enrollmentRunIds = enrollments.map(({
    courseDetails: {
      courseId,
    },
  }) => courseId);

  return recommendations.filter(({ uuid: recUuid, courseRunKeys }) => (
    recUuid !== uuid && courseRunKeys.every((key) => !enrollmentRunIds.includes(key))
  ));
}

export default async function getCourseRecommendations(courseKey) {
  const recommendationsUrl = new URL(`${getConfig().DISCOVERY_API_BASE_URL}/api/v1/course_recommendations/${courseKey}?exclude_utm=true`);
  const enrollmentsUrl = new URL(`${getConfig().LMS_BASE_URL}/api/enrollment/v1/enrollment`);
  const recommendationsResponse = await getAuthenticatedHttpClient().get(recommendationsUrl);
  const enrollmentsResponse = await getAuthenticatedHttpClient().get(enrollmentsUrl);
  return filterRecommendationsList(camelCaseObject(recommendationsResponse), camelCaseObject(enrollmentsResponse));
}

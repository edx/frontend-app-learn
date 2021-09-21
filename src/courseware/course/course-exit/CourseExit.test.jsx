import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Factory } from 'rosie';
import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';

import { fetchCourse } from '../../data';
import { buildSimpleCourseBlocks } from '../../../shared/data/__factories__/courseBlocks.factory';
import {
  initializeMockApp, logUnhandledRequests, render, screen,
} from '../../../setupTest';
import initializeStore from '../../../store';
import { appendBrowserTimezoneToUrl, executeThunk } from '../../../utils';
import CourseCelebration from './CourseCelebration';
import CourseExit from './CourseExit';
import CourseInProgress from './CourseInProgress';
import CourseNonPassing from './CourseNonPassing';

initializeMockApp();
jest.mock('@edx/frontend-platform/analytics');

describe('Course Exit Pages', () => {
  let axiosMock;
  let store;
  const defaultMetadata = Factory.build('courseMetadata', {
    user_has_passing_grade: true,
    end: '2014-02-05T05:00:00Z',
  });
  const defaultCourseBlocks = buildSimpleCourseBlocks(defaultMetadata.id, defaultMetadata.name);

  let courseMetadataUrl = `${getConfig().LMS_BASE_URL}/api/courseware/course/${defaultMetadata.id}`;
  courseMetadataUrl = appendBrowserTimezoneToUrl(courseMetadataUrl);
  const courseBlocksUrlRegExp = new RegExp(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/*`);
  const discoveryRecommendationsUrl = new RegExp(`${getConfig().DISCOVERY_API_BASE_URL}/api/v1/course_recommendations/*`);
  const enrollmentsUrl = new RegExp(`${getConfig().LMS_BASE_URL}/api/enrollment/v1/enrollment*`);
  const learningSequencesUrlRegExp = new RegExp(`${getConfig().LMS_BASE_URL}/api/learning_sequences/v1/course_outline/*`);

  function setMetadata(attributes) {
    const courseMetadata = { ...defaultMetadata, ...attributes };
    axiosMock.onGet(courseMetadataUrl).reply(200, courseMetadata);
  }

  async function fetchAndRender(component) {
    await executeThunk(fetchCourse(defaultMetadata.id), store.dispatch);
    render(component, { store });
  }

  beforeEach(() => {
    store = initializeStore();
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());
    axiosMock.onGet(courseMetadataUrl).reply(200, defaultMetadata);
    axiosMock.onGet(courseBlocksUrlRegExp).reply(200, defaultCourseBlocks);
    axiosMock.onGet(discoveryRecommendationsUrl).reply(200,
      Factory.build('courseRecommendations', {}, { numRecs: 2 }));
    axiosMock.onGet(enrollmentsUrl).reply(200, []);
    axiosMock.onGet(learningSequencesUrlRegExp).reply(403, {});

    logUnhandledRequests(axiosMock);
  });

  describe('Course Exit routing', () => {
    it('Routes to celebration for a celebration status', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'downloadable',
          cert_web_view_url: '/certificates/cooluuidgoeshere',
        },
        enrollment: {
          is_active: true,
        },
      });
      await fetchAndRender(<CourseExit />);
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    });

    it('Routes to Non-passing experience for a learner with non-passing grade', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'unverified',
        },
        enrollment: {
          is_active: true,
        },
        user_has_passing_grade: false,
      });
      await fetchAndRender(<CourseExit />);
      expect(screen.getByText('You’ve reached the end of the course!')).toBeInTheDocument();
    });

    it('Redirects if it does not match any statuses', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'bogus_status',
        },
      });
      await fetchAndRender(<CourseExit />);
      expect(global.location.href).toEqual(`http://localhost/c/${defaultMetadata.id}`);
    });
  });

  describe('Course Celebration Experience', () => {
    it('Displays download link', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'downloadable',
          download_url: 'fake.download.url',
        },
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('link', { name: 'Download my certificate' })).toBeInTheDocument();
    });

    it('Displays webview link', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'downloadable',
          cert_web_view_url: '/certificates/cooluuidgoeshere',
        },
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('link', { name: 'View my certificate' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Sample certificate' })).toBeInTheDocument();
    });

    it('Displays certificate is earned but unavailable message', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'earned_but_not_available',
          certificate_available_date: '2021-05-21T12:00:00Z',
        },
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByText('Your grade and certificate will be ready soon!')).toBeInTheDocument();
    });

    it('Displays request certificate link', async () => {
      setMetadata({ certificate_data: { cert_status: 'requesting' } });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('button', { name: 'Request certificate' })).toBeInTheDocument();
    });

    it('Displays social share icons', async () => {
      setMetadata({ certificate_data: { cert_status: 'unverified' }, marketing_url: 'https://edx.org' });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('button', { name: 'linkedin' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'facebook' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'twitter' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'email' })).toBeInTheDocument();
    });

    it('Does not display social share icons if no marketing URL', async () => {
      setMetadata({ certificate_data: { cert_status: 'unverified' } });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.queryByRole('button', { name: 'linkedin' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'facebook' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'twitter' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'email' })).not.toBeInTheDocument();
    });

    it('Displays verify identity link', async () => {
      setMetadata({
        certificate_data: { cert_status: 'unverified' },
        verify_identity_url: `${getConfig().LMS_BASE_URL}/verify_student/verify-now/${defaultMetadata.id}/`,
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('link', { name: 'Verify ID now' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Sample certificate' })).not.toBeInTheDocument();
    });

    it('Displays verification pending message', async () => {
      setMetadata({
        certificate_data: { cert_status: 'unverified' },
        verification_status: 'pending',
        verify_identity_url: `${getConfig().LMS_BASE_URL}/verify_student/verify-now/${defaultMetadata.id}/`,
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByText('Your ID verification is pending and your certificate will be available once approved.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Verify ID now' })).not.toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Sample certificate' })).not.toBeInTheDocument();
    });

    it('Displays upgrade link when available', async () => {
      setMetadata({
        certificate_data: { cert_status: 'audit_passing' },
        verified_mode: {
          access_expiration_date: '9999-08-06T12:00:00Z',
          upgrade_url: 'http://localhost:18130/basket/add/?sku=8CF08E5',
          price: 600,
          currency_symbol: '€',
        },
      });
      await fetchAndRender(<CourseCelebration />);
      // Keep these text checks in sync with "audit only" test below, so it doesn't end up checking for text that is
      // never actually there, when/if the text changes.
      expect(screen.getByText('Upgrade to pursue a verified certificate')).toBeInTheDocument();
      expect(screen.getByText('For €600 you will unlock access', { exact: false })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Upgrade now' })).toBeInTheDocument();
      const node = screen.getByText('Access to this course and its materials', { exact: false });
      expect(node.textContent).toMatch(/until August 6, 9999\./);
    });

    it('Displays nothing if audit only', async () => {
      setMetadata({
        certificate_data: { cert_status: 'audit_passing' },
        verified_mode: null,
      });
      await fetchAndRender(<CourseCelebration />);
      // Keep these queries in sync with "upgrade link" test above, so we don't end up checking for text that is
      // never actually there, when/if the text changes.
      expect(screen.queryByText('Upgrade to pursue a verified certificate')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upgrade now' })).not.toBeInTheDocument();
    });

    it('Displays LinkedIn Add to Profile button', async () => {
      setMetadata({
        certificate_data: {
          cert_status: 'downloadable',
          cert_web_view_url: '/certificates/cooluuidgoeshere',
        },
        linkedin_add_to_profile_url: 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&params',
      });
      await fetchAndRender(<CourseCelebration />);
      expect(screen.getByRole('link', { name: 'View my certificate' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Add to LinkedIn profile' })).toBeInTheDocument();
    });

    describe('Program Completion experience', () => {
      beforeEach(() => {
        setMetadata({
          certificate_data: {
            cert_status: 'downloadable',
            cert_web_view_url: '/certificates/cooluuidgoeshere',
          },
        });
      });

      it('Does not render ProgramCompletion no related programs', async () => {
        await fetchAndRender(<CourseCelebration />);
        expect(screen.queryByTestId('program-completion')).not.toBeInTheDocument();
      });

      it('Does not render ProgramCompletion if program is incomplete', async () => {
        setMetadata({
          related_programs: [{
            progress: {
              completed: 1,
              in_progress: 1,
              not_started: 1,
            },
            slug: 'micromasters',
            title: 'Example MicroMasters Program',
            uuid: '123456',
            url: 'http://localhost:18000/dashboard/programs/123456',
          }],
        });
        await fetchAndRender(<CourseCelebration />);

        expect(screen.queryByTestId('program-completion')).not.toBeInTheDocument();
      });

      it('Renders ProgramCompletion if program is complete', async () => {
        setMetadata({
          related_programs: [{
            progress: {
              completed: 3,
              in_progress: 0,
              not_started: 0,
            },
            slug: 'micromasters',
            title: 'Example MicroMasters Program',
            uuid: '123456',
            url: 'http://localhost:18000/dashboard/programs/123456',
          }],
        });
        await fetchAndRender(<CourseCelebration />);

        expect(screen.queryByTestId('program-completion')).toBeInTheDocument();
        expect(screen.queryByTestId('micromasters')).toBeInTheDocument();
      });

      it('Does not render ProgramCompletion if program is an excluded type', async () => {
        setMetadata({
          related_programs: [{
            progress: {
              completed: 3,
              in_progress: 0,
              not_started: 0,
            },
            slug: 'excluded-program-type',
            title: 'Example Excluded Program',
            uuid: '123456',
            url: 'http://localhost:18000/dashboard/programs/123456',
          }],
        });
        await fetchAndRender(<CourseCelebration />);

        expect(screen.queryByTestId('program-completion')).not.toBeInTheDocument();
        expect(screen.queryByTestId('excluded-program-type')).not.toBeInTheDocument();
      });
    });

    describe('Course recommendations', () => {
      it('Displays recommendations if at least two are available', async () => {
        await fetchAndRender(<CourseCelebration />);
        const recommendationsTable = await screen.findByTestId('course-recommendations');
        expect(recommendationsTable).toBeInTheDocument();
        expect(screen.queryByTestId('catalog-suggestion')).not.toBeInTheDocument();
      });

      it('Displays the generic catalog suggestion if fewer than two recommendations are available', async () => {
        axiosMock.onGet(discoveryRecommendationsUrl).reply(200,
          Factory.build('courseRecommendations', {}, { numRecs: 1 }));
        await fetchAndRender(<CourseCelebration />);
        const catalogSuggestion = await screen.findByTestId('catalog-suggestion');
        expect(catalogSuggestion).toBeInTheDocument();
        expect(screen.queryByTestId('course-recommendations')).not.toBeInTheDocument();
      });

      it('Will not recommend a course in which the user is already enrolled', async () => {
        const initialRecommendations = Factory.build('courseRecommendations', {}, { numRecs: 2 });
        initialRecommendations.recommendations.push(
          Factory.build('courseRecommendation', { key: 'edX+EnrolledX', title: 'Already Enrolled' }),
        );
        initialRecommendations.recommendations.push(
          Factory.build('courseRecommendation', { key: 'edX+NotEnrolledX', title: 'Not Already Enrolled' }),
        );
        axiosMock.onGet(discoveryRecommendationsUrl).reply(200, initialRecommendations);
        axiosMock.onGet(enrollmentsUrl).reply(200, [
          Factory.build('userEnrollment', '',
            {
              runKey: 'edX+EnrolledX+1T2021',
            }),
        ]);
        await fetchAndRender(<CourseCelebration />);
        const recommendationsTable = await screen.findByTestId('course-recommendations');
        expect(recommendationsTable).toBeInTheDocument();
        expect(screen.queryByText('Already Enrolled')).not.toBeInTheDocument();
        expect(screen.queryByText('Not Already Enrolled')).toBeInTheDocument();
      });

      it('Will not recommend the same course that the user just finished', async () => {
        // the uuid returned from the call to discovery is the uuid of the current course
        const initialRecommendations = Factory.build('courseRecommendations',
          { uuid: 'my_uuid' },
          { numRecs: 2 });
        initialRecommendations.recommendations.push(
          Factory.build('courseRecommendation', { uuid: 'my_uuid', title: 'Same Course' }),
        );
        axiosMock.onGet(discoveryRecommendationsUrl).reply(200, initialRecommendations);
        await fetchAndRender(<CourseCelebration />);
        const recommendationsTable = await screen.findByTestId('course-recommendations');
        expect(recommendationsTable).toBeInTheDocument();
        expect(screen.queryByText('Same Course')).not.toBeInTheDocument();
      });
    });
  });

  describe('Course Non-passing Experience', () => {
    it('Displays link to progress tab', async () => {
      setMetadata({ user_has_passing_grade: false });
      await fetchAndRender(<CourseNonPassing />);
      expect(screen.getByText('You’ve reached the end of the course!')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View grades' })).toBeInTheDocument();
    });
  });

  describe('Course in progress experience', () => {
    it('Displays link to dates tab', async () => {
      setMetadata({ user_has_passing_grade: false });
      const courseBlocks = buildSimpleCourseBlocks(defaultMetadata.id, defaultMetadata.name,
        { hasScheduledContent: true });
      axiosMock.onGet(courseBlocksUrlRegExp).reply(200, courseBlocks);
      axiosMock.onGet(learningSequencesUrlRegExp).reply(403, {});

      await fetchAndRender(<CourseInProgress />);
      expect(screen.getByText('More content is coming soon!')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View course schedule' })).toBeInTheDocument();
    });
  });
});

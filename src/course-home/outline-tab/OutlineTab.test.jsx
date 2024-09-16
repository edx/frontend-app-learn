/**
 * @jest-environment jsdom
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Factory } from 'rosie';
import { getConfig } from '@edx/frontend-platform';
import { sendTrackEvent } from '@edx/frontend-platform/analytics';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import MockAdapter from 'axios-mock-adapter';
import Cookies from 'js-cookie';
import userEvent from '@testing-library/user-event';
import messages from './messages';

import { buildMinimalCourseBlocks } from '../../shared/data/__factories__/courseBlocks.factory';
import {
  fireEvent, initializeMockApp, logUnhandledRequests, render, screen, waitFor, act,
} from '../../setupTest';
import { appendBrowserTimezoneToUrl, executeThunk } from '../../utils';
import * as thunks from '../data/thunks';
import initializeStore from '../../store';
import { CERT_STATUS_TYPE } from './alerts/certificate-status-alert/CertificateStatusAlert';
import OutlineTab from './OutlineTab';
import LoadedTabPage from '../../tab-page/LoadedTabPage';

const mockCoursewareSearchParams = jest.fn();

initializeMockApp();
jest.mock('@edx/frontend-platform/analytics');
jest.mock('../courseware-search/hooks', () => ({
  ...jest.requireActual('../courseware-search/hooks'),
  useCoursewareSearchParams: () => mockCoursewareSearchParams,
}));

const coursewareSearch = {
  query: '',
  filter: '',
  setQuery: jest.fn(),
  setFilter: jest.fn(),
  clearSearchParams: jest.fn(),
};

const mockSearchParams = ((props = coursewareSearch) => {
  mockCoursewareSearchParams.mockReturnValue(props);
});

describe('Outline Tab', () => {
  let axiosMock;

  const courseId = 'course-v1:edX+DemoX+Demo_Course';
  let courseMetadataUrl = `${getConfig().LMS_BASE_URL}/api/course_home/course_metadata/${courseId}`;
  courseMetadataUrl = appendBrowserTimezoneToUrl(courseMetadataUrl);
  const enrollmentUrl = `${getConfig().LMS_BASE_URL}/api/enrollment/v1/enrollment`;
  const goalUrl = `${getConfig().LMS_BASE_URL}/api/course_home/save_course_goal`;
  const masqueradeUrl = `${getConfig().LMS_BASE_URL}/courses/${courseId}/masquerade`;
  const outlineUrl = `${getConfig().LMS_BASE_URL}/api/course_home/outline/${courseId}`;
  const proctoringInfoUrl = `${getConfig().LMS_BASE_URL}/api/edx_proctoring/v1/user_onboarding/status?is_learning_mfe=true&course_id=${encodeURIComponent(courseId)}&username=MockUser`;

  const store = initializeStore();
  const defaultMetadata = Factory.build('courseHomeMetadata');
  const defaultTabData = Factory.build('outlineTabData');

  function setMetadata(attributes, options) {
    const courseMetadata = Factory.build('courseHomeMetadata', attributes, options);
    axiosMock.onGet(courseMetadataUrl).reply(200, courseMetadata);
  }

  function setTabData(attributes, options) {
    const outlineTabData = Factory.build('outlineTabData', attributes, options);
    axiosMock.onGet(outlineUrl).reply(200, outlineTabData);
  }

  async function fetchAndRender(path = '') {
    await executeThunk(thunks.fetchOutlineTab(courseId), store.dispatch);
    await act(async () => render(
      <MemoryRouter initialEntries={[path]}>
        <OutlineTab />
      </MemoryRouter>,
      { store },
    ));
  }

  beforeEach(async () => {
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());

    // Set defaults for network requests
    axiosMock.onGet(courseMetadataUrl).reply(200, defaultMetadata);
    axiosMock.onPost(enrollmentUrl).reply(200, {});
    axiosMock.onPost(goalUrl).reply(200, { header: 'Success' });
    axiosMock.onGet(masqueradeUrl).reply(200, { success: true });
    axiosMock.onGet(outlineUrl).reply(200, defaultTabData);
    axiosMock.onGet(proctoringInfoUrl).reply(200, {
      onboarding_status: 'created',
      onboarding_link: 'test',
      expiration_date: null,
    });

    // Mock courseware search params
    mockSearchParams();

    logUnhandledRequests(axiosMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Course Outline', () => {
    it('displays link to start course', async () => {
      await fetchAndRender();
      expect(screen.getByRole('link', { name: messages.start.defaultMessage })).toBeInTheDocument();
    });

    it('displays link to resume course', async () => {
      setTabData({
        resume_course: {
          has_visited_course: true,
          url: `${getConfig().LMS_BASE_URL}/courses/${courseId}/jump_to/block-v1:edX+Test+Block@12345abcde`,
        },
      });
      await fetchAndRender();
      expect(screen.getByRole('link', { name: 'Resume course' })).toBeInTheDocument();
    });

    it('expands section that contains resume block', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      setTabData({
        course_blocks: { blocks: courseBlocks.blocks },
      });
      await fetchAndRender();
      const expandedSectionNode = screen.getByRole('button', { name: /Title of Section/ });
      expect(expandedSectionNode).toHaveAttribute('aria-expanded', 'true');
    });

    it('includes outline_tab_notifications_slot', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      setTabData({
        course_blocks: { blocks: courseBlocks.blocks },
      });
      await fetchAndRender();

      expect(screen.getByTestId('outline_tab_notifications_slot')).toBeInTheDocument();
    });

    it('handles expand/collapse all button click', async () => {
      await fetchAndRender();
      // Button renders as "Expand All"
      const expandButton = screen.getByRole('button', { name: 'Expand all' });
      expect(expandButton).toBeInTheDocument();

      // Section initially renders collapsed
      const collapsedSectionNode = screen.getByRole('button', { name: /section/ });
      expect(collapsedSectionNode).toHaveAttribute('aria-expanded', 'false');

      // Click to expand section
      userEvent.click(expandButton);
      await waitFor(() => expect(collapsedSectionNode).toHaveAttribute('aria-expanded', 'true'));

      // Click to collapse section
      userEvent.click(expandButton);
      await waitFor(() => expect(collapsedSectionNode).toHaveAttribute('aria-expanded', 'false'));
    });

    it('displays correct icon for complete assignment', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { complete: true });
      setTabData({
        course_blocks: { blocks: courseBlocks.blocks },
      });
      await fetchAndRender();
      expect(screen.getByTitle('Completed section')).toBeInTheDocument();
    });

    it('displays correct icon for incomplete assignment', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { complete: false });
      setTabData({
        course_blocks: { blocks: courseBlocks.blocks },
      });
      await fetchAndRender();
      expect(screen.getByTitle('Incomplete section')).toBeInTheDocument();
    });

    it('SequenceLink displays link', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      setTabData({
        course_blocks: { blocks: courseBlocks.blocks },
      });
      await fetchAndRender();

      const sequenceLink = screen.getByText('Title of Sequence');
      expect(sequenceLink.getAttribute('href')).toContain(`/course/${courseId}`);
    });
  });

  describe('Suggested schedule alerts', () => {
    beforeEach(() => {
      setMetadata({ is_enrolled: true, is_self_paced: true });
      setTabData({
        dates_banner_info: {
          content_type_gating_enabled: true,
          missed_deadlines: true,
          missed_gated_content: true,
          verified_upgrade_link: 'http://localhost:18130/basket/add/?sku=8CF08E5',
        },
      }, {
        date_blocks: [
          {
            assignment_type: 'Homework',
            date: '2010-08-20T05:59:40.942669Z',
            date_type: 'assignment-due-date',
            description: '',
            learner_has_access: true,
            title: 'Missed assignment',
            extra_info: null,
          },
        ],
      });
    });

    it('renders UpgradeToShiftDatesAlert', async () => {
      await fetchAndRender();

      expect(screen.getByText('It looks like you missed some important deadlines based on our suggested schedule.')).toBeInTheDocument();
      expect(screen.getByText('To keep yourself on track, you can update this schedule and shift the past due assignments into the future. Don’t worry—you won’t lose any of the progress you’ve made when you shift your due dates.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Upgrade to shift due dates' })).toBeInTheDocument();
    });

    it('sends analytics event onClick of upgrade button in UpgradeToShiftDatesAlert', async () => {
      await fetchAndRender();
      sendTrackEvent.mockClear();

      const upgradeButton = screen.getByRole('button', { name: 'Upgrade to shift due dates' });
      fireEvent.click(upgradeButton);

      expect(sendTrackEvent).toHaveBeenCalledTimes(1);
      expect(sendTrackEvent).toHaveBeenCalledWith('edx.bi.ecommerce.upsell_links_clicked', {
        org_key: 'edX',
        courserun_key: courseId,
        linkCategory: 'personalized_learner_schedules',
        linkName: 'course_home_upgrade_shift_dates',
        linkType: 'button',
        pageName: 'course_home',
      });
    });
  });

  describe('Welcome Message', () => {
    beforeEach(() => {
      setMetadata({ is_enrolled: true });
    });

    it('does not render show more/less button under 100 words', async () => {
      await fetchAndRender();
      expect(screen.getByTestId('alert-container-welcome')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    });

    describe('over 100 words', () => {
      beforeEach(async () => {
        setTabData({
          welcome_message_html: '<p>'
            + 'This is a test welcome message that happens to be longer than one hundred words. We hope it will be shortened.'
            + 'This is a test welcome message that happens to be longer than one hundred words. We hope it will be shortened.'
            + 'This is a test welcome message that happens to be longer than one hundred words. We hope it will be shortened.'
            + 'This is a test welcome message that happens to be longer than one hundred words. We hope it will be shortened.'
            + 'This is a test welcome message that happens to be longer than one hundred words. We hope it will be shortened.'
            + '</p>',
        });
        await fetchAndRender();
      });

      it('shortens message', async () => {
        expect(screen.getByTestId('short-welcome-message-iframe')).toBeInTheDocument();
        const showMoreButton = screen.queryByRole('button', { name: 'Show More' });
        expect(showMoreButton).toBeInTheDocument();
      });

      it('renders show more/less button and handles click', async () => {
        expect(screen.getByTestId('alert-container-welcome')).toBeInTheDocument();
        let showMoreButton = screen.getByRole('button', { name: 'Show More' });
        expect(showMoreButton).toBeInTheDocument();

        userEvent.click(showMoreButton);
        let showLessButton = screen.getByRole('button', { name: 'Show Less' });
        expect(showLessButton).toBeInTheDocument();
        expect(screen.getByTestId('long-welcome-message-iframe')).toBeInTheDocument();

        userEvent.click(showLessButton);
        showLessButton = screen.queryByRole('button', { name: 'Show Less' });
        expect(showLessButton).not.toBeInTheDocument();
        showMoreButton = screen.getByRole('button', { name: 'Show More' });
        expect(showMoreButton).toBeInTheDocument();
      });
    });

    it('ignores comments and misformatted HTML', async () => {
      setTabData({
        welcome_message_html: '<p class="additional-spaces-in-tag"   >'
      + '<!-- Even if the welcome_message_html length is above the limit because of comments, we hope it will not be shortened. -->'
      + '<!-- Even if the welcome_message_html length is above the limit because of comments, we hope it will not be shortened. -->'
      + 'Test welcome message that happens to be longer than one hundred words because of comments but displayed content is less.'
      + 'It should not be shortened.'
      + '<!-- Even if the welcome_message_html length is above the limit because of comments, we hope it will not be shortened. -->'
      + '<!-- Even if the welcome_message_html length is above the limit because of comments, we hope it will not be shortened. -->'
      + '</p>',
      });
      await fetchAndRender();
      const showMoreButton = screen.queryByRole('button', { name: 'Show More' });
      expect(showMoreButton).not.toBeInTheDocument();
    });

    it('does not display if no update available', async () => {
      setTabData({ welcome_message_html: null });
      await fetchAndRender();
      expect(screen.queryByTestId('alert-container-welcome')).not.toBeInTheDocument();
    });
  });

  describe('Course Dates', () => {
    it('renders when course date blocks are populated', async () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() + 1);
      setMetadata({ is_enrolled: true });
      setTabData({}, {
        date_blocks: [
          {
            date_type: 'course-start-date',
            date: startDate.toISOString(),
            title: 'Start',
          },
        ],
      });
      await fetchAndRender();
      expect(screen.getByRole('heading', { name: 'Important dates' })).toBeInTheDocument();
    });

    it('does not render when course date blocks are not populated', async () => {
      setMetadata({ is_enrolled: true });
      await fetchAndRender();
      expect(screen.queryByRole('heading', { name: 'Important dates' })).not.toBeInTheDocument();
    });

    it('sends analytics event onClick of upgrade link', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setMetadata({ is_enrolled: true });
      setTabData({}, {
        date_blocks: [
          {
            date_type: 'verified-upgrade-deadline',
            date: tomorrow.toISOString(),
            link: 'https://example.com/upgrade',
            link_text: 'Upgrade to Verified Certificate',
            title: 'Verification Upgrade Deadline',
          },
        ],
      });
      await fetchAndRender();
      sendTrackEvent.mockClear();

      const upgradeLink = screen.getByRole('link', { name: 'Upgrade to Verified Certificate' });
      fireEvent.click(upgradeLink);

      expect(sendTrackEvent).toHaveBeenCalledTimes(1);
      expect(sendTrackEvent).toHaveBeenCalledWith('edx.bi.ecommerce.upsell_links_clicked', {
        org_key: 'edX',
        courserun_key: courseId,
        linkCategory: '(none)',
        linkName: 'course_home_dates',
        linkType: 'link',
        pageName: 'course_home',
      });
    });
  });

  describe('Start or Resume Course Card', () => {
    it('renders startOrResumeCourseCard', async () => {
      await fetchAndRender();
      expect(screen.queryByTestId('start-resume-card')).toBeInTheDocument();
    });
  });

  describe('Weekly Learning Goal', () => {
    it('does not post goals while masquerading', async () => {
      setMetadata({ is_enrolled: true, original_user_is_staff: true });
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
        },
      });
      const spy = jest.spyOn(thunks, 'saveWeeklyLearningGoal');

      await fetchAndRender();
      const button = await screen.getByTestId('weekly-learning-goal-input-Regular');
      fireEvent.click(button);
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('post goal via query param', async () => {
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
        },
      });
      const spy = jest.spyOn(thunks, 'saveWeeklyLearningGoal');
      sendTrackEvent.mockClear();

      await fetchAndRender('http://localhost/?weekly_goal=3');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(sendTrackEvent).toHaveBeenCalledWith('enrollment.email.clicked.setgoal', {});
    });

    it('emit start course event via query param', async () => {
      sendTrackEvent.mockClear();
      await fetchAndRender('http://localhost/?start_course=1');
      expect(sendTrackEvent).toHaveBeenCalledWith('enrollment.email.clicked.startcourse', {});
    });

    describe('weekly learning goal is not set', () => {
      beforeEach(async () => {
        setTabData({
          course_goals: {
            weekly_learning_goal_enabled: true,
          },
        });

        await fetchAndRender();
      });

      it('renders weekly learning goal card', async () => {
        expect(screen.queryByTestId('weekly-learning-goal-card')).toBeInTheDocument();
      });

      it('disables the subscribe button if no goal is set', async () => {
        expect(screen.getByLabelText(messages.setGoalReminder.defaultMessage)).toBeDisabled();
      });

      it.each([
        { level: 'Casual', days: 1 },
        { level: 'Regular', days: 3 },
        { level: 'Intense', days: 5 },
      ])('calls the API with a goal of $days when $level goal is clicked', async ({ level, days }) => {
        // click on Casual goal
        const button = await screen.queryByTestId(`weekly-learning-goal-input-${level}`);
        fireEvent.click(button);
        // Verify the request was made
        await waitFor(() => {
          expect(axiosMock.history.post[0].url).toMatch(goalUrl);
          // subscribe is turned on automatically
          expect(axiosMock.history.post[0].data).toMatch(`{"course_id":"${courseId}","days_per_week":${days},"subscribed_to_reminders":true}`);
          // verify that the additional info about subscriptions shows up
          expect(screen.queryByText(messages.goalReminderDetail.defaultMessage)).toBeInTheDocument();
        });
        expect(screen.getByLabelText(messages.setGoalReminder.defaultMessage)).toBeEnabled();
      });

      it('shows and hides subscribe to reminders additional text', async () => {
        const button = await screen.getByTestId('weekly-learning-goal-input-Regular');
        fireEvent.click(button);
        // Verify the request was made
        await waitFor(() => {
          expect(axiosMock.history.post[0].url).toMatch(goalUrl);
          // subscribe is turned on automatically
          expect(axiosMock.history.post[0].data).toMatch(`{"course_id":"${courseId}","days_per_week":3,"subscribed_to_reminders":true}`);
          // verify that the additional info about subscriptions shows up
          expect(screen.queryByText(messages.goalReminderDetail.defaultMessage)).toBeInTheDocument();
        });
        expect(screen.getByLabelText(messages.setGoalReminder.defaultMessage)).toBeEnabled();

        // Click on subscribe to reminders toggle
        const subscriptionSwitch = await screen.getByRole('switch', { name: messages.setGoalReminder.defaultMessage });
        expect(subscriptionSwitch).toBeInTheDocument();

        fireEvent.click(subscriptionSwitch);
        await waitFor(() => {
          expect(axiosMock.history.post[1].url).toMatch(goalUrl);
          expect(axiosMock.history.post[1].data)
            .toMatch(`{"course_id":"${courseId}","days_per_week":3,"subscribed_to_reminders":false}`);
        });

        // verify that the additional info about subscriptions gets hidden
        expect(screen.queryByText(messages.goalReminderDetail.defaultMessage)).not.toBeInTheDocument();
      });
    });

    it('has button for weekly learning goal selected', async () => {
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
          selected_goal: {
            subscribed_to_reminders: true,
            days_per_week: 3,
          },
        },
      });
      await fetchAndRender();

      const button = await screen.queryByTestId('weekly-learning-goal-input-Regular');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('flag-button-selected');
    });

    it('renders weekly learning goal card if ProctoringInfoPanel is not shown', async () => {
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
        },
      });
      axiosMock.onGet(proctoringInfoUrl).reply(404);
      await fetchAndRender();
      expect(screen.queryByTestId('weekly-learning-goal-card')).toBeInTheDocument();
    });

    it('renders weekly learning goal card if ProctoringInfoPanel is not enabled', async () => {
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
          enableProctoredExams: false,
        },
      });
      await fetchAndRender();
      expect(screen.queryByTestId('weekly-learning-goal-card')).toBeInTheDocument();
    });

    it('renders weekly learning goal card if ProctoringInfoPanel is enabled', async () => {
      setTabData({
        course_goals: {
          weekly_learning_goal_enabled: true,
          enableProctoredExams: true,
        },
      });
      await fetchAndRender();
      expect(screen.queryByTestId('weekly-learning-goal-card')).toBeInTheDocument();
    });
  });

  describe('Course Handouts', () => {
    it('renders title when handouts are available', async () => {
      await fetchAndRender();
      expect(screen.queryByRole('heading', { name: 'Course Handouts' })).toBeInTheDocument();
    });

    it('does not display title if no handouts available', async () => {
      setTabData({ handouts_html: null });
      await fetchAndRender();
      expect(screen.queryByRole('heading', { name: 'Course Handouts' })).not.toBeInTheDocument();
    });
  });

  describe('Course Tools', () => {
    it('renders title when tools are available', async () => {
      await fetchAndRender();
      expect(screen.getByRole('heading', { name: 'Course Tools' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Bookmarks' })).toBeInTheDocument();
    });

    it('does not render title when tools are not available', async () => {
      setTabData({
        course_tools: [],
      });
      await fetchAndRender();
      expect(screen.queryByRole('heading', { name: 'Course Tools' })).not.toBeInTheDocument();
    });
  });

  describe('Alert List', () => {
    describe('Private Course Alert', () => {
      it('does not display alert for enrolled user', async () => {
        setMetadata({ is_enrolled: true });
        await fetchAndRender();
        expect(screen.queryByRole('button', { name: 'Enroll now' })).not.toBeInTheDocument();
        expect(screen.queryByText('to access the full course')).not.toBeInTheDocument();
      });

      it('does not display enrollment button if enrollment is not available', async () => {
        setTabData({
          enroll_alert: {
            can_enroll: false,
          },
        });
        await fetchAndRender();

        const alert = await screen.findByTestId('private-course-alert');
        expect(alert).toHaveAttribute('role', 'alert');

        expect(screen.queryByRole('button', { name: 'Enroll now' })).not.toBeInTheDocument();
        expect(screen.getByText('You must be enrolled in the course to see course content.')).toBeInTheDocument();
      });

      it('displays alert for unenrolled user', async () => {
        await fetchAndRender();

        const alert = await screen.findByTestId('private-course-alert');
        expect(alert).toHaveAttribute('role', 'alert');

        expect(screen.getByRole('button', { name: 'Enroll now' })).toBeInTheDocument();
      });

      it('handles button click', async () => {
        const { location } = window;
        delete window.location;
        window.location = {
          reload: jest.fn(),
        };
        await fetchAndRender();

        const button = await screen.findByRole('button', { name: 'Enroll now' });
        fireEvent.click(button);
        await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
        expect(axiosMock.history.post[0].data)
          .toEqual(JSON.stringify({ course_details: { course_id: courseId } }));
        expect(window.location.reload).toHaveBeenCalledTimes(1);

        window.location = location;
      });
    });

    describe('Access Expiration Alert', () => {
      it('renders page banner on masquerade', async () => {
        setMetadata({ is_enrolled: true, original_user_is_staff: true });
        setTabData({
          access_expiration: {
            expiration_date: '2020-01-01T12:00:00Z',
            masquerading_expired_course: true,
          },
        });
        await executeThunk(thunks.fetchOutlineTab(courseId), store.dispatch);
        await act(async () => render(<LoadedTabPage courseId={courseId} activeTabSlug="outline">...</LoadedTabPage>, { store }));
        const instructorToolbar = await screen.getByTestId('instructor-toolbar');
        expect(instructorToolbar).toBeInTheDocument();
        expect(screen.getByText('This learner no longer has access to this course. Their access expired on', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('1/1/2020', { exact: false })).toBeInTheDocument();
      });

      it('does not render banner when not masquerading', async () => {
        setMetadata({ is_enrolled: true, original_user_is_staff: true });
        setTabData({
          access_expiration: {
            expiration_date: '2020-01-01T12:00:00Z',
            masquerading_expired_course: false,
          },
        });
        await executeThunk(thunks.fetchOutlineTab(courseId), store.dispatch);
        await act(async () => render(<LoadedTabPage courseId={courseId} activeTabSlug="outline">...</LoadedTabPage>, { store }));
        const instructorToolbar = await screen.getByTestId('instructor-toolbar');
        expect(instructorToolbar).toBeInTheDocument();
        expect(screen.queryByText('This learner no longer has access to this course. Their access expired on', { exact: false })).not.toBeInTheDocument();
      });
    });

    describe('Course Start Alert', () => {
      // Only appears if enrolled and before start of course
      it('appears several days out', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 100);
        setMetadata({ is_enrolled: true, start: '2999-01-01T00:00:00Z' });
        await fetchAndRender();
        const node = await screen.findByText('Course starts', { exact: false });
        expect(node.textContent).toMatch(/.* on .*/); // several days away uses "on" before date
      });

      it('appears today', async () => {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() + 1);
        setMetadata({ is_enrolled: true, start: startDate });
        await fetchAndRender();
        const node = await screen.findByText('Course starts', { exact: false });
        expect(node.textContent).toMatch(/.* at .*/); // same day uses "at" before date
      });
    });

    describe('Course End Alert', () => {
      // Only appears if enrolled and within 14 days before the end of course
      it('appears several days out', async () => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 13);
        setMetadata({ is_enrolled: true });
        setTabData({}, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: endDate.toISOString(),
              title: 'End',
            },
          ],
        });
        await fetchAndRender();
        const node = await screen.findByText('This course is ending', { exact: false });
        expect(node.textContent).toMatch(/.* on .*/); // several days away uses "on" before date
      });

      it('appears today', async () => {
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({}, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: endDate.toISOString(),
              title: 'End',
            },
          ],
        });
        await fetchAndRender();
        const node = await screen.findByText('This course is ending', { exact: false });
        expect(node.textContent).toMatch(/.* at .*/); // same day uses "at" before date
      });
    });

    describe('Certificate Available Alert', () => {
      // Must satisfy two conditions for alert to appear: enrolled and between course end and cert availability
      it('appears', async () => {
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          cert_data: {
            cert_status: CERT_STATUS_TYPE.EARNED_NOT_AVAILABLE,
            cert_web_view_url: null,
            certificate_available_date: tomorrow.toISOString(),
          },
        }, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: yesterday.toISOString(),
              title: 'End',
            },
            {
              date_type: 'certificate-available-date',
              date: tomorrow.toISOString(),
              title: 'Cert Available',
            },
          ],
        });
        await fetchAndRender();
        expect(screen.queryByText('Your grade and certificate status will be available soon.')).toBeInTheDocument();
      });
      it('renders verification alert', async () => {
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          cert_data: {
            cert_status: CERT_STATUS_TYPE.UNVERIFIED,
            cert_web_view_url: null,
          },
        }, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: yesterday.toISOString(),
              title: 'End',
            },
            {
              date_type: 'certificate-available-date',
              date: tomorrow.toISOString(),
              title: 'Cert Available',
            },
            {
              date_type: 'verification-deadline-date',
              date: tomorrow.toISOString(),
              link_text: 'Verify',
              title: 'Verification Upgrade Deadline',
            },
          ],
        });
        await fetchAndRender();
        expect(screen.queryByText('Verify your identity to qualify for a certificate.')).toBeInTheDocument();
      });
      it('renders non passing grade', async () => {
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          cert_data: {},
          user_has_passing_grade: false,
          has_ended: true,
          enrollment_mode: 'verified',
        }, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: yesterday.toISOString(),
              title: 'End',
            },
            {
              date_type: 'certificate-available-date',
              date: tomorrow.toISOString(),
              title: 'Cert Available',
            },
            {
              date_type: 'verification-deadline-date',
              date: tomorrow.toISOString(),
              link_text: 'Verify',
              title: 'Verification Upgrade Deadline',
            },
          ],
        });
        await fetchAndRender();
        screen.getAllByText('You are not yet eligible for a certificate');
        expect(screen.queryByText('You are not yet eligible for a certificate')).toBeInTheDocument();
      });
      it('tracks request cert button', async () => {
        sendTrackEvent.mockClear();
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          cert_data: {
            cert_status: CERT_STATUS_TYPE.REQUESTING,
            cert_web_view_url: null,
          },
        }, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: yesterday.toISOString(),
              title: 'End',
            },
            {
              date_type: 'certificate-available-date',
              date: tomorrow.toISOString(),
              title: 'Cert Available',
            },
            {
              date_type: 'verification-deadline-date',
              date: tomorrow.toISOString(),
              link_text: 'Verify',
              title: 'Verification Upgrade Deadline',
            },
          ],
        });
        await fetchAndRender();
        sendTrackEvent.mockClear();
        const requestingButton = screen.getByRole('button', { name: 'Request certificate' });
        fireEvent.click(requestingButton);
        expect(sendTrackEvent).toHaveBeenCalledTimes(1);
        expect(sendTrackEvent).toHaveBeenCalledWith(
          'edx.ui.lms.course_outline.certificate_alert_request_cert_button.clicked',
          {
            courserun_key: courseId,
            is_staff: false,
            org_key: 'edX',
          },
        );
      });

      it('tracks unverified cert button', async () => {
        sendTrackEvent.mockClear();
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          cert_data: {
            cert_status: CERT_STATUS_TYPE.UNVERIFIED,
            cert_web_view_url: null,
          },
        }, {
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: yesterday.toISOString(),
              title: 'End',
            },
            {
              date_type: 'certificate-available-date',
              date: tomorrow.toISOString(),
              title: 'Cert Available',
            },
            {
              date_type: 'verification-deadline-date',
              date: tomorrow.toISOString(),
              link_text: 'Verify',
              title: 'Verification Upgrade Deadline',
            },
          ],
        });
        await fetchAndRender();
        sendTrackEvent.mockClear();
        const requestingButton = screen.getByRole('link', { name: 'Verify my ID' });
        fireEvent.click(requestingButton);
        expect(sendTrackEvent).toHaveBeenCalledTimes(1);
        expect(sendTrackEvent).toHaveBeenCalledWith(
          'edx.ui.lms.course_outline.certificate_alert_unverified_button.clicked',
          {
            courserun_key: courseId,
            is_staff: false,
            org_key: 'edX',
          },
        );
      });
    });

    describe('Scheduled Content Alert', () => {
      it('appears correctly', async () => {
        const now = new Date();
        const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { hasScheduledContent: true });
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          course_blocks: { blocks: courseBlocks.blocks },
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: tomorrow.toISOString(),
              title: 'End',
            },
          ],
        });
        await fetchAndRender();
        expect(screen.queryByText('More content is coming soon!')).toBeInTheDocument();
      });
    });
    describe('Scheduled Content Alert not present without courseBlocks', () => {
      it('appears correctly', async () => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        setMetadata({ is_enrolled: true });
        setTabData({
          course_blocks: null,
          date_blocks: [
            {
              date_type: 'course-end-date',
              date: tomorrow.toISOString(),
              title: 'End',
            },
          ],
        });
        await fetchAndRender();
        expect(screen.getByRole('link', { name: messages.start.defaultMessage })).toBeInTheDocument();
        expect(screen.queryByText('More content is coming soon!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Certificate (web) Complete Alert', () => {
    it('appears', async () => {
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      setMetadata({ is_enrolled: true });
      setTabData({
        cert_data: {
          cert_status: CERT_STATUS_TYPE.DOWNLOADABLE,
          cert_web_view_url: 'certificate/testuuid',
          certificate_available_date: null,
        },
      }, {
        date_blocks: [
          {
            date_type: 'course-end-date',
            date: yesterday.toISOString(),
            title: 'End',
          },
        ],
      });
      await fetchAndRender();
      expect(screen.queryByText('Congratulations! Your certificate is ready.')).toBeInTheDocument();
    });
  });

  describe('Requesting Certificate Alert', () => {
    it('appears', async () => {
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      setMetadata({ is_enrolled: true });
      setTabData({
        cert_data: {
          cert_status: CERT_STATUS_TYPE.REQUESTING,
          cert_web_view_url: null,
          certificate_available_date: null,
        },
      }, {
        date_blocks: [
          {
            date_type: 'course-end-date',
            date: yesterday.toISOString(),
            title: 'End',
          },
        ],
      });
      await fetchAndRender();
      expect(screen.queryByText('Congratulations! Your certificate is ready.')).toBeInTheDocument();
      expect(screen.queryByText('Request certificate')).toBeInTheDocument();
    });
  });

  describe('Proctoring Info Panel', () => {
    const onboardingReleaseDate = new Date();
    onboardingReleaseDate.setDate(new Date().getDate() - 7);
    it('appears', async () => {
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).toBeInTheDocument();
    });

    it('appears for verified', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'verified',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByRole('link', { name: 'Complete Onboarding' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).toBeInTheDocument();
      expect(screen.queryByText('You must complete the onboarding process prior to taking any proctored exam.')).not.toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).not.toBeInTheDocument();
    });

    it('appears for rejected', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'rejected',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByRole('link', { name: 'Complete Onboarding' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).toBeInTheDocument();
      expect(screen.queryByText('You must complete the onboarding process prior to taking any proctored exam.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('appears for submitted', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'submitted',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your submitted profile is in review.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('appears for second_review_required', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'second_review_required',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your submitted profile is in review.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('appears for other_course_approved if not expiring soon', async () => {
      const expirationDate = new Date();
      // Set the expiration date 40 days in the future, so as not to trigger the 28 day expiration warning
      expirationDate.setTime(expirationDate.getTime() + 3456900000);
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'other_course_approved',
        onboarding_link: 'test',
        expiration_date: expirationDate.toString(),
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your onboarding exam has been approved in another course.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).not.toBeInTheDocument();
    });

    it('displays expiration warning', async () => {
      const expirationDate = new Date();
      // This message will render if the expiration date is within 28 days; set the date 10 days in future
      expirationDate.setTime(expirationDate.getTime() + 864800000);
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'verified',
        onboarding_link: 'test',
        expiration_date: expirationDate.toString(),
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your onboarding profile has been approved. However, your onboarding status is expiring soon. Please complete onboarding again to ensure that you will be able to continue taking proctored exams.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('displays expiration warning for other course', async () => {
      const expirationDate = new Date();
      // This message will render if the expiration date is within 28 days; set the date 10 days in future
      expirationDate.setTime(expirationDate.getTime() + 864800000);
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'other_course_approved',
        onboarding_link: 'test',
        expiration_date: expirationDate.toString(),
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your onboarding profile has been approved. However, your onboarding status is expiring soon. Please complete onboarding again to ensure that you will be able to continue taking proctored exams.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('displays expired', async () => {
      const expirationDate = new Date();
      // This message appears after expiration, set the date 10 days in the past
      expirationDate.setTime(expirationDate.getTime() - 864800000);
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'verified',
        onboarding_link: 'test',
        expiration_date: expirationDate.toString(),
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText('Your onboarding status has expired. Please complete onboarding again to continue taking proctored exams.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('appears for no status', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: '',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByRole('link', { name: 'Complete Onboarding' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).toBeInTheDocument();
      expect(screen.queryByText('You must complete the onboarding process prior to taking any proctored exam.')).toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).toBeInTheDocument();
    });

    it('does not appear for 404', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(404);
      await fetchAndRender();
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).not.toBeInTheDocument();
    });

    it('appears with a disabled link if onboarding not yet released', async () => {
      const futureReleaseDate = new Date();
      futureReleaseDate.setDate(new Date().getDate() + 7);
      const expectedDateStr = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(futureReleaseDate);

      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: '',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: futureReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByText(`Onboarding Opens: ${expectedDateStr}`)).toBeInTheDocument();
    });

    it('appears and ignores a missing release date', async () => {
      axiosMock.onGet(proctoringInfoUrl).reply(200, {
        onboarding_status: 'verified',
        onboarding_link: 'test',
        expiration_date: null,
        onboarding_release_date: onboardingReleaseDate.toISOString(),
      });
      await fetchAndRender();
      await screen.findByText('This course contains proctored exams');
      expect(screen.queryByRole('link', { name: 'Complete Onboarding' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Review instructions and system requirements' })).toBeInTheDocument();
      expect(screen.queryByText('You must complete the onboarding process prior to taking any proctored exam.')).not.toBeInTheDocument();
      expect(screen.queryByText('Onboarding profile review can take 2+ business days.')).not.toBeInTheDocument();
    });
  });

  describe('Account Activation Alert', () => {
    beforeEach(() => {
      const intersectionObserverMock = () => ({
        observe: () => null,
        disconnect: () => null,
      });
      window.IntersectionObserver = jest.fn().mockImplementation(intersectionObserverMock);
    });
    it('displays account activation alert if cookie is set true', async () => {
      Cookies.set = jest.fn();
      Cookies.get = jest.fn().mockImplementation(() => 'true');
      Cookies.remove = jest.fn().mockImplementation(() => { Cookies.get = jest.fn(); });

      await fetchAndRender();
      expect(screen.queryByText('Activate your account so you can log back in')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'resend the email' })).toBeInTheDocument();
    });

    it('do not displays account activation alert if cookie is not set true', async () => {
      Cookies.set = jest.fn();
      Cookies.get = jest.fn();
      Cookies.remove = jest.fn().mockImplementation(() => { Cookies.get = jest.fn(); });

      await fetchAndRender();
      expect(screen.queryByText('Activate your account so you can log back in')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'resend the email' })).not.toBeInTheDocument();
    });

    it('sends account activation email on clicking the re-send email in account activation alert', async () => {
      Cookies.set = jest.fn();
      Cookies.get = jest.fn().mockImplementation(() => 'true');
      Cookies.remove = jest.fn().mockImplementation(() => { Cookies.get = jest.fn(); });

      await fetchAndRender();

      axiosMock = new MockAdapter(getAuthenticatedHttpClient());
      const resendEmailUrl = `${getConfig().LMS_BASE_URL}/api/send_account_activation_email`;
      axiosMock.onPost(resendEmailUrl).reply(200, {});

      const resendLink = screen.getByRole('button', { name: 'resend the email' });
      fireEvent.click(resendLink);

      await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
      expect(axiosMock.history.post[0].url).toEqual(resendEmailUrl);
    });

    it('section should show hidden from toc message when hide_from_toc is true', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      const courseBlocksIds = Object.keys(courseBlocks.blocks);
      const newCourseBlocks = courseBlocksIds.reduce((blocks, blockId) => ({
        ...blocks,
        [blockId]: {
          ...courseBlocks.blocks[blockId],
          hide_from_toc: true,
        },
      }), {});

      setTabData({
        course_blocks: { blocks: newCourseBlocks },
      });
      await fetchAndRender();

      const iconHiddenFromTocSectionNode = screen.getByTestId('hide-from-toc-section-icon');
      const textHiddenFromTocSectionNode = screen.getByTestId('hide-from-toc-section-text');
      expect(iconHiddenFromTocSectionNode).toBeInTheDocument();
      expect(textHiddenFromTocSectionNode).toBeInTheDocument();
      expect(textHiddenFromTocSectionNode.textContent).toBe('Hidden in Course Outline, accessible via link');
    });

    it('section should not show hidden from toc message when hide_from_toc is false', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      const courseBlocksIds = Object.keys(courseBlocks.blocks);
      const newCourseBlocks = courseBlocksIds.reduce((blocks, blockId) => ({
        ...blocks,
        [blockId]: {
          ...courseBlocks.blocks[blockId],
          hide_from_toc: false,
        },
      }), {});

      setTabData({
        course_blocks: { blocks: newCourseBlocks },
      });
      await fetchAndRender();

      const iconHiddenFromTocSectionNode = screen.queryByTestId('hide-from-toc-section-icon');
      const textHiddenFromTocSectionNode = screen.queryByTestId('hide-from-toc-section-text');

      expect(iconHiddenFromTocSectionNode).not.toBeInTheDocument();
      expect(textHiddenFromTocSectionNode).not.toBeInTheDocument();
    });

    it('sequence link should show hidden from toc message when hide_from_toc is true', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      const courseBlocksIds = Object.keys(courseBlocks.blocks);
      const newCourseBlocks = courseBlocksIds.reduce((blocks, blockId) => ({
        ...blocks,
        [blockId]: {
          ...courseBlocks.blocks[blockId],
          hide_from_toc: true,
        },
      }), {});

      setTabData({
        course_blocks: { blocks: newCourseBlocks },
      });
      await fetchAndRender();

      const iconHiddenFromTocSequenceLinkNode = screen.getByTestId('hide-from-toc-sequence-link-icon');
      const textHiddenFromTocSequenceLink = screen.getByTestId('hide-from-toc-sequence-link-text');
      expect(iconHiddenFromTocSequenceLinkNode).toBeInTheDocument();
      expect(textHiddenFromTocSequenceLink).toBeInTheDocument();
      expect(textHiddenFromTocSequenceLink.textContent).toBe('Subsections are not navigable between each other, they can only be accessed through their link.');
    });

    it('sequence link not show hidden from toc message when hide_from_toc is false', async () => {
      const { courseBlocks } = await buildMinimalCourseBlocks(courseId, 'Title', { resumeBlock: true });
      const courseBlocksIds = Object.keys(courseBlocks.blocks);
      const newCourseBlocks = courseBlocksIds.reduce((blocks, blockId) => ({
        ...blocks,
        [blockId]: {
          ...courseBlocks.blocks[blockId],
          hide_from_toc: false,
        },
      }), {});

      setTabData({
        course_blocks: { blocks: newCourseBlocks },
      });
      await fetchAndRender();

      const iconHiddenFromTocSequenceLink = screen.queryByTestId('hide-from-toc-sequence-link-icon');
      const textHiddenFromTocSequenceLink = screen.queryByTestId('hide-from-toc-sequence-link-text');

      expect(iconHiddenFromTocSequenceLink).not.toBeInTheDocument();
      expect(textHiddenFromTocSequenceLink).not.toBeInTheDocument();
    });
  });
});

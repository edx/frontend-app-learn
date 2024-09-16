/* eslint-disable react/jsx-no-constructed-context-values */
import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { breakpoints } from '@openedx/paragon';

import MockAdapter from 'axios-mock-adapter';
import React from 'react';
import { Factory } from 'rosie';
import {
  fireEvent, initializeMockApp, render, screen, waitFor,
} from '../../../../../setupTest';
import initializeStore from '../../../../../store';
import { appendBrowserTimezoneToUrl, executeThunk } from '../../../../../utils';

import { fetchCourse } from '../../../../data';
import SidebarContext from '../../SidebarContext';
import { ID } from './index';
import NotificationTray from './NotificationTray';

initializeMockApp();
jest.mock('@edx/frontend-platform/analytics');

describe('NotificationTray', () => {
  let axiosMock;
  let store;

  const defaultMetadata = Factory.build('courseMetadata');
  const courseId = defaultMetadata.id;
  let courseMetadataUrl = `${getConfig().LMS_BASE_URL}/api/courseware/course/${defaultMetadata.id}`;
  courseMetadataUrl = appendBrowserTimezoneToUrl(courseMetadataUrl);

  const courseHomeMetadata = Factory.build('courseHomeMetadata');
  const courseHomeMetadataUrl = appendBrowserTimezoneToUrl(`${getConfig().LMS_BASE_URL}/api/course_home/course_metadata/${courseId}`);

  function setMetadata(attributes, options) {
    const updatedCourseHomeMetadata = Factory.build('courseHomeMetadata', attributes, options);
    axiosMock.onGet(courseHomeMetadataUrl).reply(200, updatedCourseHomeMetadata);
  }

  async function fetchAndRender(component) {
    await executeThunk(fetchCourse(defaultMetadata.id), store.dispatch);
    render(component, { store });
  }

  beforeEach(async () => {
    global.innerWidth = breakpoints.large.minWidth;
    store = initializeStore();
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());
    axiosMock.onGet(courseMetadataUrl).reply(200, defaultMetadata);
    axiosMock.onGet(courseHomeMetadataUrl).reply(200, courseHomeMetadata);
  });

  it('renders notification tray and close tray button', async () => {
    global.innerWidth = breakpoints.extraLarge.minWidth;
    const toggleNotificationTray = jest.fn();
    await fetchAndRender(
      <SidebarContext.Provider value={{
        currentSidebar: ID,
        courseId,
        toggleSidebar: toggleNotificationTray,
        shouldDisplayFullScreen: false,
      }}
      >
        <NotificationTray />
      </SidebarContext.Provider>,
    );
    expect(screen.getByText('Notifications'))
      .toBeInTheDocument();
    const notificationCloseIconButton = screen.getByRole('button', { name: /Close notification tray/i });
    expect(notificationCloseIconButton)
      .toBeInTheDocument();
    expect(notificationCloseIconButton)
      .toHaveClass('btn-icon-primary');
    fireEvent.click(notificationCloseIconButton);
    expect(toggleNotificationTray)
      .toHaveBeenCalledTimes(1);

    // should not render responsive "Back to course" to close the tray
    expect(screen.queryByText('Back to course'))
      .not
      .toBeInTheDocument();
  });

  it('includes notification_tray_slot', async () => {
    await fetchAndRender(
      <SidebarContext.Provider value={{
        currentSidebar: ID,
        courseId,
      }}
      >
        <NotificationTray />
      </SidebarContext.Provider>,
    );
    expect(screen.getByTestId('notification_tray_slot')).toBeInTheDocument();
  });

  it('renders no notifications message if no verified mode', async () => {
    setMetadata({ verified_mode: null });
    await fetchAndRender(
      <SidebarContext.Provider value={{
        currentSidebar: ID,
        courseId,
      }}
      >
        <NotificationTray />
      </SidebarContext.Provider>,
    );
    expect(screen.queryByText('You have no new notifications at this time.'))
      .toBeInTheDocument();
  });

  it('renders notification tray with full screen "Back to course" at responsive view', async () => {
    global.innerWidth = breakpoints.medium.maxWidth;
    const toggleNotificationTray = jest.fn();
    await fetchAndRender(
      <SidebarContext.Provider value={{
        currentSidebar: ID,
        courseId,
        shouldDisplayFullScreen: true,
        toggleSidebar: toggleNotificationTray,
      }}
      >
        <NotificationTray />
      </SidebarContext.Provider>,
    );

    const responsiveCloseButton = screen.getByRole('button', { name: 'Back to course' });
    await waitFor(() => expect(responsiveCloseButton)
      .toBeInTheDocument());

    fireEvent.click(responsiveCloseButton);
    expect(toggleNotificationTray)
      .toHaveBeenCalledTimes(1);
  });

  it('marks notification as seen 3 seconds later', async () => {
    const onNotificationSeen = jest.fn();
    await fetchAndRender(
      <SidebarContext.Provider value={{
        currentSidebar: ID,
        courseId,
        onNotificationSeen,
      }}
      >
        <NotificationTray />
      </SidebarContext.Provider>,
    );
    expect(onNotificationSeen).toHaveBeenCalledTimes(0);
    await waitFor(() => expect(onNotificationSeen).toHaveBeenCalledTimes(1), { timeout: 3500 });
  });
});

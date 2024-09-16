import React, { useContext, useEffect, useMemo } from 'react';

import { sendTrackEvent } from '@edx/frontend-platform/analytics';
import { PluginSlot } from '@openedx/frontend-plugin-framework';
import { useModel } from '../../../../../../generic/model-store';
import { WIDGETS } from '../../../../../../constants';
import SidebarContext from '../../../SidebarContext';

const NotificationsWidget = () => {
  const {
    courseId,
    onNotificationSeen,
    upgradeNotificationCurrentState,
    setUpgradeNotificationCurrentState,
    hideNotificationbar,
    toggleSidebar,
    isNotificationbarAvailable,
    currentSidebar,
  } = useContext(SidebarContext);
  const course = useModel('coursewareMeta', courseId);

  const {
    end,
    enrollmentEnd,
    enrollmentMode,
    enrollmentStart,
    start,
    verificationStatus,
  } = course;

  const {
    courseModes,
    org,
    verifiedMode,
    username,
  } = useModel('courseHomeMeta', courseId);

  const activeCourseModes = useMemo(() => courseModes?.map(mode => mode.slug), [courseModes]);

  const notificationTrayEventProperties = {
    course_end: end,
    course_modes: activeCourseModes,
    course_start: start,
    courserun_key: courseId,
    enrollment_end: enrollmentEnd,
    enrollment_mode: enrollmentMode,
    enrollment_start: enrollmentStart,
    is_upgrade_notification_visible: !!verifiedMode,
    name: 'New Sidebar Notification Tray',
    org_key: org,
    username,
    verification_status: verificationStatus,
  };

  const onToggleSidebar = () => {
    toggleSidebar(currentSidebar, WIDGETS.NOTIFICATIONS);
  };

  // After three seconds, update notificationSeen (to hide red dot)
  useEffect(() => {
    setTimeout(onNotificationSeen, 3000);
    sendTrackEvent('edx.ui.course.upgrade.new_sidebar.notifications', notificationTrayEventProperties);
  }, []);

  if (hideNotificationbar || !isNotificationbarAvailable) { return null; }

  return (
    <div className="border border-light-400 rounded-sm" data-testid="notification-widget">
      <PluginSlot
        id="notification_widget_slot"
        pluginProps={{
          courseId,
          notificationCurrentState: upgradeNotificationCurrentState,
          setNotificationCurrentState: setUpgradeNotificationCurrentState,
          toggleSidebar: onToggleSidebar,
        }}
      />
    </div>
  );
};

export default NotificationsWidget;

import React from 'react';

import { PluginSlot } from '@openedx/frontend-plugin-framework';

import CourseOutlineTrigger from '../../courseware/course/sidebar/sidebars/course-outline/CourseOutlineTrigger';

interface Props {
  courseId: string;
  sectionId?: string;
  sequenceId?: string;
  unitId?: string;
  isStaff?: boolean;
}

export const CourseOutlineSidebarTriggerSlot : React.FC<Props> = ({
  courseId, sectionId, sequenceId, unitId, isStaff,
}) => (
  <PluginSlot
    id="course_outline_sidebar_trigger_slot"
    slotOptions={{
      mergeProps: true,
    }}
    pluginProps={{
      courseId,
      sectionId,
      sequenceId,
      unitId,
      isStaff,
    }}
  >
    <CourseOutlineTrigger isMobileView={false} />
  </PluginSlot>
);

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { history } from '@edx/frontend-platform';

import CourseBreadcrumbs from './CourseBreadcrumbs';
import SequenceContainer from './SequenceContainer';
import { createSequenceIdList } from '../utils';
import AlertList from '../../user-messages/AlertList';
import CourseHeader from './CourseHeader';
import CourseSock from './course-sock';
import CourseTabsNavigation from './CourseTabsNavigation';
import InstructorToolbar from '../InstructorToolbar';

export default function Course({
  courseOrg, courseNumber, courseName, courseUsageKey, courseId, sequenceId, unitId, models, tabs, verifiedMode,
}) {
  const nextSequenceHandler = useCallback(() => {
    const sequenceIds = createSequenceIdList(models, courseId);
    const currentIndex = sequenceIds.indexOf(sequenceId);
    if (currentIndex < sequenceIds.length - 1) {
      const nextSequenceId = sequenceIds[currentIndex + 1];
      const nextSequence = models[nextSequenceId];
      const nextUnitId = nextSequence.children[0];
      history.push(`/course/${courseUsageKey}/${nextSequenceId}/${nextUnitId}`);
    }
  });

  const previousSequenceHandler = useCallback(() => {
    const sequenceIds = createSequenceIdList(models, courseId);
    const currentIndex = sequenceIds.indexOf(sequenceId);
    if (currentIndex > 0) {
      const previousSequenceId = sequenceIds[currentIndex - 1];
      const previousSequence = models[previousSequenceId];
      const previousUnitId = previousSequence.children[previousSequence.children.length - 1];
      history.push(`/course/${courseUsageKey}/${previousSequenceId}/${previousUnitId}`);
    }
  });

  return (
    <>
      <CourseHeader
        courseOrg={courseOrg}
        courseNumber={courseNumber}
        courseName={courseName}
      />
      <InstructorToolbar
        courseUsageKey={courseUsageKey}
        courseId={courseId}
        sequenceId={sequenceId}
        unitId={unitId}
      />
      <main className="d-flex flex-column flex-grow-1">
        <div className="container-fluid">
          <CourseTabsNavigation tabs={tabs} className="mb-3" activeTabSlug="courseware" />
          <AlertList topic="course" className="mb-3" />
          <CourseBreadcrumbs
            courseUsageKey={courseUsageKey}
            courseId={courseId}
            sequenceId={sequenceId}
            unitId={unitId}
            models={models}
          />
        </div>
        <SequenceContainer
          key={sequenceId}
          courseUsageKey={courseUsageKey}
          courseId={courseId}
          sequenceId={sequenceId}
          unitId={unitId}
          models={models}
          onNext={nextSequenceHandler}
          onPrevious={previousSequenceHandler}
        />
        {verifiedMode && <CourseSock verifiedMode={verifiedMode} />}
      </main>
    </>
  );
}

Course.propTypes = {
  courseOrg: PropTypes.string.isRequired,
  courseNumber: PropTypes.string.isRequired,
  courseName: PropTypes.string.isRequired,
  courseUsageKey: PropTypes.string.isRequired,
  courseId: PropTypes.string.isRequired,
  sequenceId: PropTypes.string.isRequired,
  unitId: PropTypes.string,
  models: PropTypes.objectOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    children: PropTypes.arrayOf(PropTypes.string),
    parentId: PropTypes.string,
  })).isRequired,
  tabs: PropTypes.arrayOf(PropTypes.shape({
    slug: PropTypes.string.isRequired,
    priority: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  })).isRequired,
  verifiedMode: PropTypes.shape({
    price: PropTypes.number.isRequired,
    currency: PropTypes.string.isRequired,
    currencySymbol: PropTypes.string,
    sku: PropTypes.string.isRequired,
    upgradeUrl: PropTypes.string.isRequired,
  }),
};

Course.defaultProps = {
  unitId: undefined,
  verifiedMode: null,
};

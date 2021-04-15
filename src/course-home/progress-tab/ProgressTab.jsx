import React from 'react';
import { layoutGenerator } from 'react-break';

import CertificateStatus from './certificate-status/CertificateStatus';
import CourseCompletion from './course-completion/CourseCompletion';
import CourseGrade from './grades/course-grade/CourseGrade';
import DetailedGrades from './grades/detailed-grades/DetailedGrades';
import GradeSummary from './grades/grade-summary/GradeSummary';
import ProgressHeader from './ProgressHeader';
import RelatedLinks from './related-links/RelatedLinks';

function ProgressTab() {
  const layout = layoutGenerator({
    mobile: 0,
    desktop: 992,
  });

  const OnMobile = layout.is('mobile');
  const OnDesktop = layout.isAtLeast('desktop');

  return (
    <>
      <ProgressHeader />
      <div className="row w-100 m-0">
        {/* Main body */}
        <div className="col-12 col-lg-8 p-0">
          <CourseCompletion />
          <OnMobile>
            <CertificateStatus />
          </OnMobile>
          <CourseGrade />
          <div className="my-4 p-4 rounded shadow-sm">
            <GradeSummary />
            <DetailedGrades />
          </div>
        </div>

        {/* Side panel */}
        <div className="col-12 col-lg-4 p-0 px-lg-4">
          <OnDesktop>
            <CertificateStatus />
          </OnDesktop>
          <RelatedLinks />
        </div>
      </div>
    </>
  );
}

export default ProgressTab;

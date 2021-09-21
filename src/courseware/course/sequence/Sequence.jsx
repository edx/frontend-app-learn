/* eslint-disable no-use-before-define */
import React, {
  useEffect, useContext, useState,
} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  sendTrackEvent,
  sendTrackingLogEvent,
} from '@edx/frontend-platform/analytics';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { useSelector } from 'react-redux';
import { history } from '@edx/frontend-platform';
import SequenceExamWrapper from '@edx/frontend-lib-special-exams';

import PageLoading from '../../../generic/PageLoading';
import { UserMessagesContext, ALERT_TYPES } from '../../../generic/user-messages';
import useWindowSize, { responsiveBreakpoints } from '../../../generic/tabs/useWindowSize';
import { useModel } from '../../../generic/model-store';

import CourseLicense from '../course-license';
import messages from './messages';
import HiddenAfterDue from './hidden-after-due';
import { SequenceNavigation, UnitNavigation } from './sequence-navigation';
import SequenceContent from './SequenceContent';
import NotificationTray from '../NotificationTray';
import NotificationTrigger from '../NotificationTrigger';

/** [MM-P2P] Experiment */
import { isMobile } from '../../../experiments/mm-p2p/utils';
import { MMP2PFlyover, MMP2PFlyoverMobile } from '../../../experiments/mm-p2p';

function Sequence({
  unitId,
  sequenceId,
  courseId,
  unitNavigationHandler,
  nextSequenceHandler,
  previousSequenceHandler,
  intl,
  toggleNotificationTray,
  notificationTrayVisible,
  isNotificationTrayVisible,
  notificationStatus,
  setNotificationStatus,
  onNotificationSeen,
  upgradeNotificationCurrentState,
  setupgradeNotificationCurrentState,
  mmp2p,
}) {
  const course = useModel('coursewareMeta', courseId);
  const sequence = useModel('sequences', sequenceId);
  const unit = useModel('units', unitId);
  const sequenceStatus = useSelector(state => state.courseware.sequenceStatus);
  const specialExamsEnabledWaffleFlag = useSelector(state => state.courseware.specialExamsEnabledWaffleFlag);
  const proctoredExamsEnabledWaffleFlag = useSelector(state => state.courseware.proctoredExamsEnabledWaffleFlag);
  const shouldDisplayNotificationTrigger = useWindowSize().width < responsiveBreakpoints.small.minWidth;

  const handleNext = () => {
    const nextIndex = sequence.unitIds.indexOf(unitId) + 1;
    if (nextIndex < sequence.unitIds.length) {
      const newUnitId = sequence.unitIds[nextIndex];
      handleNavigate(newUnitId);
    } else {
      nextSequenceHandler();
    }
  };

  const handlePrevious = () => {
    const previousIndex = sequence.unitIds.indexOf(unitId) - 1;
    if (previousIndex >= 0) {
      const newUnitId = sequence.unitIds[previousIndex];
      handleNavigate(newUnitId);
    } else {
      previousSequenceHandler();
    }
  };

  const handleNavigate = (destinationUnitId) => {
    unitNavigationHandler(destinationUnitId);
  };

  const logEvent = (eventName, widgetPlacement, targetUnitId) => {
    // Note: tabs are tracked with a 1-indexed position
    // as opposed to a 0-index used throughout this MFE
    const currentIndex = sequence.unitIds.length > 0 ? sequence.unitIds.indexOf(unitId) : 0;
    const payload = {
      current_tab: currentIndex + 1,
      id: unitId,
      tab_count: sequence.unitIds.length,
      widget_placement: widgetPlacement,
    };
    if (targetUnitId) {
      const targetIndex = sequence.unitIds.indexOf(targetUnitId);
      payload.target_tab = targetIndex + 1;
    }
    sendTrackEvent(eventName, payload);
    sendTrackingLogEvent(eventName, payload);
  };

  const { add, remove } = useContext(UserMessagesContext);
  useEffect(() => {
    let id = null;
    if (sequenceStatus === 'loaded') {
      if (sequence.bannerText) {
        id = add({
          code: null,
          dismissible: false,
          text: sequence.bannerText,
          type: ALERT_TYPES.INFO,
          topic: 'sequence',
        });
      }
    }
    return () => {
      if (id) {
        remove(id);
      }
    };
  }, [sequenceStatus, sequence]);

  const [unitHasLoaded, setUnitHasLoaded] = useState(false);
  const handleUnitLoaded = () => {
    setUnitHasLoaded(true);
  };

  // We want hide the unit navigation if we're in the middle of navigating to another unit
  // but not if other things about the unit change, like the bookmark status.
  // The array property of this useEffect ensures that we only hide the unit navigation
  // while navigating to another unit.
  useEffect(() => {
    if (unit) {
      setUnitHasLoaded(false);
    }
  }, [(unit || {}).id]);

  if (sequenceStatus === 'loading') {
    if (!sequenceId) {
      return (<div> {intl.formatMessage(messages['learn.sequence.no.content'])} </div>);
    }
    return (
      <PageLoading
        srMessage={intl.formatMessage(messages['learn.loading.learning.sequence'])}
      />
    );
  }

  if (sequenceStatus === 'loaded' && sequence.isHiddenAfterDue) {
    // Shouldn't even be here - these sequences are normally stripped out of the navigation.
    // But we are here, so render a notice instead of the normal content.
    return <HiddenAfterDue courseId={courseId} />;
  }

  /*
  TODO: When the micro-frontend supports viewing special exams without redirecting to the legacy
  experience, we can remove this whole conditional. For now, though, we show the spinner here
  because we expect CoursewareContainer to be performing a redirect to the legacy experience while
  we're waiting. That redirect may take a few seconds, so we show the spinner in the meantime.
  */
  if (sequenceStatus === 'loaded') {
    const shouldRedirectSpecialExams = sequence.isTimeLimited && !specialExamsEnabledWaffleFlag;
    const shouldRedirectProctoredExams = sequence.isProctored && specialExamsEnabledWaffleFlag
      && !proctoredExamsEnabledWaffleFlag;

    if (shouldRedirectSpecialExams || shouldRedirectProctoredExams) {
      return (
        <PageLoading
          srMessage={intl.formatMessage(messages['learn.loading.learning.sequence'])}
        />
      );
    }
  }

  const gated = sequence && sequence.gatedContent !== undefined && sequence.gatedContent.gated;
  const goToCourseExitPage = () => {
    history.push(`/c/${courseId}/course-end`);
  };

  const defaultContent = (
    <div className="sequence-container" style={{ display: 'inline-flex', flexDirection: 'row' }}>
      <div className={classNames('sequence', { 'position-relative': shouldDisplayNotificationTrigger })} style={{ width: '100%' }}>
        <SequenceNavigation
          sequenceId={sequenceId}
          unitId={unitId}
          className="mb-4"

          /** [MM-P2P] Experiment */
          mmp2p={mmp2p}

          nextSequenceHandler={() => {
            logEvent('edx.ui.lms.sequence.next_selected', 'top');
            handleNext();
          }}
          onNavigate={(destinationUnitId) => {
            logEvent('edx.ui.lms.sequence.tab_selected', 'top', destinationUnitId);
            handleNavigate(destinationUnitId);
          }}
          previousSequenceHandler={() => {
            logEvent('edx.ui.lms.sequence.previous_selected', 'top');
            handlePrevious();
          }}
          goToCourseExitPage={() => goToCourseExitPage()}
        />

        {shouldDisplayNotificationTrigger ? (
          <NotificationTrigger
            toggleNotificationTray={toggleNotificationTray}
            isNotificationTrayVisible={isNotificationTrayVisible}
            notificationStatus={notificationStatus}
            setNotificationStatus={setNotificationStatus}
            upgradeNotificationCurrentState={upgradeNotificationCurrentState}
          />
        ) : null}

        <div className="unit-container flex-grow-1">
          <SequenceContent
            courseId={courseId}
            gated={gated}
            sequenceId={sequenceId}
            unitId={unitId}
            unitLoadedHandler={handleUnitLoaded}
            notificationTrayVisible={notificationTrayVisible}
            /** [MM-P2P] Experiment */
            mmp2p={mmp2p}
          />
          {unitHasLoaded && (
          <UnitNavigation
            sequenceId={sequenceId}
            unitId={unitId}
            onClickPrevious={() => {
              logEvent('edx.ui.lms.sequence.previous_selected', 'bottom');
              handlePrevious();
            }}
            onClickNext={() => {
              logEvent('edx.ui.lms.sequence.next_selected', 'bottom');
              handleNext();
            }}
            goToCourseExitPage={() => goToCourseExitPage()}
          />
          )}
        </div>
      </div>
      {notificationTrayVisible ? (
        <NotificationTray
          toggleNotificationTray={toggleNotificationTray}
          notificationTrayVisible={notificationTrayVisible}
          notificationStatus={notificationStatus}
          onNotificationSeen={onNotificationSeen}
          upgradeNotificationCurrentState={upgradeNotificationCurrentState}
          setupgradeNotificationCurrentState={setupgradeNotificationCurrentState}
        />
      ) : null }

      {/** [MM-P2P] Experiment */}
      {(mmp2p.state.isEnabled && mmp2p.flyover.isVisible) && (
        isMobile()
          ? <MMP2PFlyoverMobile options={mmp2p} />
          : <MMP2PFlyover options={mmp2p} />
      )}
    </div>
  );

  if (sequenceStatus === 'loaded') {
    return (
      <div>
        <SequenceExamWrapper
          sequence={sequence}
          courseId={courseId}
          isStaff={course.isStaff}
          originalUserIsStaff={course.originalUserIsStaff}
        >
          {defaultContent}
        </SequenceExamWrapper>
        <CourseLicense license={course.license || undefined} />
      </div>
    );
  }

  // sequence status 'failed' and any other unexpected sequence status.
  return (
    <p className="text-center py-5 mx-auto" style={{ maxWidth: '30em' }}>
      {intl.formatMessage(messages['learn.course.load.failure'])}
    </p>
  );
}

Sequence.propTypes = {
  unitId: PropTypes.string,
  sequenceId: PropTypes.string,
  courseId: PropTypes.string.isRequired,
  unitNavigationHandler: PropTypes.func.isRequired,
  nextSequenceHandler: PropTypes.func.isRequired,
  previousSequenceHandler: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  toggleNotificationTray: PropTypes.func,
  notificationTrayVisible: PropTypes.bool,
  isNotificationTrayVisible: PropTypes.func,
  notificationStatus: PropTypes.string.isRequired,
  setNotificationStatus: PropTypes.func.isRequired,
  onNotificationSeen: PropTypes.func,
  upgradeNotificationCurrentState: PropTypes.string.isRequired,
  setupgradeNotificationCurrentState: PropTypes.func.isRequired,

  /** [MM-P2P] Experiment */
  mmp2p: PropTypes.shape({
    flyover: PropTypes.shape({
      isVisible: PropTypes.bool.isRequired,
    }),
    meta: PropTypes.shape({
      showLock: PropTypes.bool,
    }),
    state: PropTypes.shape({
      isEnabled: PropTypes.bool.isRequired,
    }),
  }),
};

Sequence.defaultProps = {
  sequenceId: null,
  unitId: null,
  toggleNotificationTray: null,
  notificationTrayVisible: null,
  isNotificationTrayVisible: null,
  onNotificationSeen: null,

  /** [MM-P2P] Experiment */
  mmp2p: {
    flyover: { isVisible: false },
    meta: { showLock: false },
    state: { isEnabled: false },
  },
};

export default injectIntl(Sequence);

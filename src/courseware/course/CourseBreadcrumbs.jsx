import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { getConfig } from '@edx/frontend-platform';
import { FormattedMessage } from '@edx/frontend-platform/i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons';
import { useSelector } from 'react-redux';
import { Hyperlink, MenuItem, SelectMenu } from '@edx/paragon';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import {
  sendTrackingLogEvent,
  sendTrackEvent,
} from '@edx/frontend-platform/analytics';
import { useModel, useModels } from '../../generic/model-store';
/** [MM-P2P] Experiment */
import { MMP2PFlyoverTrigger } from '../../experiments/mm-p2p';

function CourseBreadcrumb({
  content, withSeparator,
}) {
  const defaultContent = content.filter(destination => destination.default)[0];
  const administrator = getAuthenticatedUser() ? getAuthenticatedUser().administrator : false;
  function logEvent(target) {
    const eventName = 'edx.ui.lms.jump_nav.selected';
    const payload = {
      target_name: target.label,
      id: target.id,
      current_id: defaultContent.id,
      widget_placement: 'breadcrumb',
    };
    sendTrackEvent(eventName, payload);
    sendTrackingLogEvent(eventName, payload);
  }

  return (
    <>
      {withSeparator && (
        <li className="mx-2 text-primary-500 text-truncate text-nowrap" role="presentation" aria-hidden>/</li>
      )}

      <li style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      >
        { getConfig().ENABLE_JUMPNAV !== 'true' || content.length < 2 || !administrator
          ? (
            <a className="text-primary-500" href={defaultContent.url}>{defaultContent.label}
            </a>
          )
          : (
            <SelectMenu isLink defaultMessage={defaultContent.label}>
              {content.map(item => (
                <MenuItem
                  as={Hyperlink}
                  defaultSelected={item.default}
                  destination={item.url}
                  onClick={logEvent(item)}
                >
                  {item.label}
                </MenuItem>
              ))}
            </SelectMenu>
          )}

      </li>
    </>
  );
}
CourseBreadcrumb.propTypes = {
  content: PropTypes.arrayOf(
    PropTypes.shape({
      default: PropTypes.bool,
      url: PropTypes.string,
      id: PropTypes.string,
      label: PropTypes.string,
    }),
  ).isRequired,
  withSeparator: PropTypes.bool,
};

CourseBreadcrumb.defaultProps = {
  withSeparator: false,
};

export default function CourseBreadcrumbs({
  courseId,
  sectionId,
  sequenceId,
  /** [MM-P2P] Experiment */
  mmp2p,
}) {
  const course = useModel('coursewareMeta', courseId);
  const courseStatus = useSelector(state => state.courseware.courseStatus);
  const sections = course ? Object.fromEntries(useModels('sections', course.sectionIds).map(section => [section.id, section])) : null;
  const possibleSequences = sections && sectionId ? sections[sectionId].sequenceIds : [];
  const sequences = Object.fromEntries(useModels('sequences', possibleSequences).map(sequence => [sequence.id, sequence]));
  const sequenceStatus = useSelector(state => state.courseware.sequenceStatus);

  const links = useMemo(() => {
    const temp = [];
    if (courseStatus === 'loaded' && sequenceStatus === 'loaded') {
      temp.push(course.sectionIds.map(id => ({
        id,
        label: sections[id].title,
        default: (id === sectionId),
        // navigate to first sequence in section, (TODO: navigate to first incomplete sequence in section)
        url: `${getConfig().BASE_URL}/course/${courseId}/${sections[id].sequenceIds[0]}`,
      })));
      temp.push(sections[sectionId].sequenceIds.map(id => ({
        id,
        label: sequences[id].title,
        default: id === sequenceId,
        // first unit it section (TODO: navigate to first incomplete  in sequence)
        url: `${getConfig().BASE_URL}/course/${courseId}/${sequences[id].id}/${sequences[id].unitIds[0]}`,
      })));
    }
    return temp;
  }, [courseStatus, sections, sequences]);
  return (
    <nav aria-label="breadcrumb" className="my-4 d-inline-block col-sm-10">
      <ol className="list-unstyled d-flex align-items-center m-0">
        <li>
          <a
            href={`${getConfig().LMS_BASE_URL}/courses/${courseId}/course/`}
            className="flex-shrink-0 text-primary"
          >
            <FontAwesomeIcon icon={faHome} className="mr-2" />
            <FormattedMessage
              id="learn.breadcrumb.navigation.course.home"
              description="The course home link in breadcrumbs nav"
              defaultMessage="Course"
            />
          </a>
        </li>
        {links.map(content => (
          <CourseBreadcrumb
            content={content}
            withSeparator
          />
        ))}
        {/** [MM-P2P] Experiment */}
        {mmp2p.state && mmp2p.state.isEnabled && (
          <MMP2PFlyoverTrigger options={mmp2p} />
        )}
      </ol>
    </nav>
  );
}

CourseBreadcrumbs.propTypes = {
  courseId: PropTypes.string.isRequired,
  sectionId: PropTypes.string,
  sequenceId: PropTypes.string,
  /** [MM-P2P] Experiment */
  mmp2p: PropTypes.shape({
    state: PropTypes.shape({
      isEnabled: PropTypes.bool.isRequired,
    }),
  }),
};

CourseBreadcrumbs.defaultProps = {
  sectionId: null,
  sequenceId: null,
  /** [MM-P2P] Experiment */
  mmp2p: {},
};

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { getConfig } from '@edx/frontend-platform';
import { FormattedMessage } from '@edx/frontend-platform/i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons';
import { useSelector } from 'react-redux';
import { SelectMenu } from '@edx/paragon';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useModel, useModels } from '../../generic/model-store';
/** [MM-P2P] Experiment */
import { MMP2PFlyoverTrigger } from '../../experiments/mm-p2p';
import ConnectedJumpNavMenuItem from './JumpNavMenuItem';

function CourseBreadcrumb({
  content, withSeparator, courseId, unitId,
}) {
  const defaultContent = content.filter(destination => destination.default)[0] || { id: courseId, label: '' };
  const { administrator } = getAuthenticatedUser();

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
            <a className="text-primary-500" href={`/course/${courseId}/${defaultContent.id}`}>
              {defaultContent.label}
            </a>
          )
          : (
            <SelectMenu isLink defaultMessage={defaultContent.label}>
              {content.map(item => (
                <ConnectedJumpNavMenuItem
                  isDefault={item.default}
                  sequences={item.sequences}
                  courseId={courseId}
                  title={item.label}
                  currentUnit={unitId}
                />
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
      id: PropTypes.string,
      label: PropTypes.string,
    }),
  ).isRequired,
  unitId: PropTypes.string,
  withSeparator: PropTypes.bool,
  courseId: PropTypes.string,
};

CourseBreadcrumb.defaultProps = {
  withSeparator: false,
  unitId: null,
  courseId: null,
};

export default function CourseBreadcrumbs({
  courseId,
  sectionId,
  sequenceId,
  unitId,
  /** [MM-P2P] Experiment */
  mmp2p,
}) {
  const course = useModel('coursewareMeta', courseId);
  const courseStatus = useSelector(state => state.courseware.courseStatus);
  const sequenceStatus = useSelector(state => state.courseware.sequenceStatus);

  const allSequencesInSections = Object.fromEntries(useModels('sections', course.sectionIds).map(section => [section.id, {
    default: section.id === sectionId,
    title: section.title,
    sequences: useModels('sequences', section.sequenceIds),
  }]));

  const links = useMemo(() => {
    const chapters = [];
    const sequentials = [];
    if (courseStatus === 'loaded' && sequenceStatus === 'loaded') {
      Object.entries(allSequencesInSections).forEach(([id, section]) => {
        chapters.push({
          id,
          label: section.title,
          default: section.default,
          sequences: section.sequences,
        });
        if (section.default) {
          section.sequences.forEach(sequence => {
            sequentials.push({
              id: sequence.id,
              label: sequence.title,
              default: sequence.id === sequenceId,
              sequences: [sequence],
            });
          });
        }
      });
    }
    return [chapters, sequentials];
  }, [courseStatus, sequenceStatus, allSequencesInSections]);

  return (
    <nav aria-label="breadcrumb" className="my-4 d-inline-block col-sm-10">
      <ol className="list-unstyled d-flex  flex-nowrap align-items-center m-0">
        <li className="list-unstyled d-flex m-0">
          <a
            href={`/courses/${courseId}/home`}
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
            courseId={courseId}
            sequenceId={sequenceId}
            content={content}
            unitId={unitId}
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
  unitId: PropTypes.string,
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
  unitId: null,
  /** [MM-P2P] Experiment */
  mmp2p: {},
};

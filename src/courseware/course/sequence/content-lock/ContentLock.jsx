import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { history } from '@edx/frontend-platform';
import { Button } from '@edx/paragon';

import messages from './messages';

function ContentLock({
  intl, courseId, prereqSectionName, prereqId, sequenceTitle,
}) {
  const handleClick = useCallback(() => {
    history.push(`/c/${courseId}/${prereqId}`);
  });

  return (
    <>
      <h3>
        <FontAwesomeIcon icon={faLock} />
        {' '}
        {sequenceTitle}
      </h3>
      <h4>{intl.formatMessage(messages['learn.contentLock.content.locked'])}</h4>
      <p>
        {intl.formatMessage(messages['learn.contentLock.complete.prerequisite'], {
          prereqSectionName,
        })}
      </p>
      <p>
        <Button variant="primary" onClick={handleClick}>{intl.formatMessage(messages['learn.contentLock.goToSection'])}</Button>
      </p>
    </>
  );
}
ContentLock.propTypes = {
  intl: intlShape.isRequired,
  courseId: PropTypes.string.isRequired,
  prereqSectionName: PropTypes.string.isRequired,
  prereqId: PropTypes.string.isRequired,
  sequenceTitle: PropTypes.string.isRequired,
};
export default injectIntl(ContentLock);

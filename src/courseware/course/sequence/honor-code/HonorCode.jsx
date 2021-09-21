import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { getConfig, history } from '@edx/frontend-platform';
import { FormattedMessage, injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { ActionRow, Alert, Button } from '@edx/paragon';

import { saveIntegritySignature } from '../../../data';
import messages from './messages';

function HonorCode({ intl, courseId }) {
  const dispatch = useDispatch();
  const siteName = getConfig().SITE_NAME;
  const honorCodeUrl = `${process.env.TERMS_OF_SERVICE_URL}#honor-code`;

  const handleCancel = () => history.push(`/c/${courseId}/home`);

  const handleAgree = () => {
    dispatch(saveIntegritySignature(courseId));
  };

  return (
    <Alert variant="light" aria-live="off">
      <h4 aria-level="3">
        {siteName}{' '}
        {intl.formatMessage(messages['learn.honorCode.name'])}
      </h4>

      <p>
        <FormattedMessage
          id="learn.honorCode.content"
          defaultMessage="Honesty and academic integrity are important to {siteName} and the institutions providing courses and programs on the {siteName} site. By clicking “I agree” below, I confirm that I have read, understand, and will abide by the {link} for the {siteName} Site."
          values={{
            siteName,
            link: <a href={honorCodeUrl}>{intl.formatMessage(messages['learn.honorCode.name'])}</a>,
          }}
        />
      </p>

      <ActionRow>
        <ActionRow.Spacer />
        <Button variant="tertiary" onClick={handleCancel}>
          {intl.formatMessage(messages['learn.honorCode.cancel'])}
        </Button>
        <Button variant="primary" onClick={handleAgree}>
          {intl.formatMessage(messages['learn.honorCode.agree'])}
        </Button>
      </ActionRow>
    </Alert>
  );
}

HonorCode.propTypes = {
  intl: intlShape.isRequired,
  courseId: PropTypes.string.isRequired,
};

export default injectIntl(HonorCode);

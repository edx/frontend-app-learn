import React from 'react';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Form } from '@openedx/paragon';

import { MasqueradeStatus, Payload } from './data/api';
import messages from './messages';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onSubmit' | 'onError'> {
  onError: (error: string) => void;
  onSubmit: (payload: Payload) => Promise<MasqueradeStatus>;
}

export const MasqueradeUserNameInput: React.FC<Props> = ({ onSubmit, onError, ...otherProps }) => {
  const intl = useIntl();

  const handleSubmit = React.useCallback((userIdentifier: string) => {
    const payload: Payload = {
      role: 'student',
      user_name: userIdentifier, // user name or email
    };
    onSubmit(payload).then((data) => {
      if (data && data.success) {
        global.location.reload();
      } else {
        const error = (data && data.error) || '';
        onError(error);
      }
    }).catch(() => {
      const message = intl.formatMessage(messages.genericError);
      onError(message);
    });
    return true;
  }, [onError]);

  const handleKeyPress = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      return handleSubmit(event.currentTarget.value);
    }
    return true;
  }, [handleSubmit]);

  return (
    <Form.Control
      aria-labelledby="masquerade-search-label"
      label={intl.formatMessage(messages.userNameLabel)}
      onKeyPress={handleKeyPress}
      {...otherProps}
    />
  );
};

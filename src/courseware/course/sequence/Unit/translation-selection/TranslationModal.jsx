import React from 'react';
import PropTypes from 'prop-types';

import { useIntl } from '@edx/frontend-platform/i18n';
import {
  StandardModal,
  ActionRow,
  Button,
  Icon,
  ListBox,
  ListBoxOption,
} from '@edx/paragon';
import { Check } from '@edx/paragon/icons';

import useTranslationSelection, { languages } from './useTranslationSelection';
import messages, { languageMessages } from './messages';

import './TranslationModal.scss';

const TranslationModal = ({ courseId, isOpen, close }) => {
  const { formatMessage } = useIntl();
  const { selectedIndex, setSelectedIndex, onSubmit } = useTranslationSelection({ courseId, close });

  return (
    <StandardModal
      title={formatMessage(messages.languageSelectionModalTitle)}
      isOpen={isOpen}
      onClose={close}
      footerNode={(
        <ActionRow>
          <ActionRow.Spacer />
          <Button variant="tertiary" onClick={close}>
            {formatMessage(messages.cancelButtonText)}
          </Button>
          <Button onClick={onSubmit}>{formatMessage(messages.submitButtonText)}</Button>
        </ActionRow>
      )}
    >
      <ListBox className="listbox-container">
        {languages.map(([key, value], index) => (
          <ListBoxOption
            className="d-flex justify-content-between"
            key={key}
            selectedOptionIndex={selectedIndex}
            onSelect={() => setSelectedIndex(index)}
          >
            {formatMessage(languageMessages[value])}
            {selectedIndex === index && <Icon src={Check} />}
          </ListBoxOption>
        ))}
      </ListBox>
    </StandardModal>
  );
};

TranslationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  close: PropTypes.func.isRequired,
  courseId: PropTypes.string.isRequired,
};

export default TranslationModal;

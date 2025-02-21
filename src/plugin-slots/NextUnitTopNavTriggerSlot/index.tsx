import React from 'react';

import { PluginSlot } from '@openedx/frontend-plugin-framework';

import NextButton from '../../courseware/course/sequence/sequence-navigation/generic/NextButton';

interface Props {
  courseId: string | '';
  disabled: boolean;
  buttonText: string | '';
  nextLink: string;
  sequenceId: string;
  onClickHandler: () => void;
  variant: string;
  buttonStyle: string;
}

export const NextUnitTopNavTriggerSlot : React.FC<Props> = ({
  courseId,
  disabled,
  buttonText,
  nextLink,
  sequenceId,
  onClickHandler,
  variant,
  buttonStyle,
}) => (
  <PluginSlot
    id="next_unit_top_nav_trigger_slot"
    pluginProps={{
      courseId,
      disabled,
      buttonText,
      nextLink,
      sequenceId,
      onClickHandler,
      variant,
      buttonStyle,
    }}
  >
    <NextButton
      {...{
        variant,
        buttonStyle,
        onClickHandler,
        nextLink,
        disabled,
        buttonText,
      }}
    />
  </PluginSlot>
);

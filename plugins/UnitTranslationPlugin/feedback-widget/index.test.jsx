import { shallow } from '@edx/react-unit-test-utils';

import FeedbackWidget from './index';

jest.mock('@edx/paragon', () => jest.requireActual('@edx/react-unit-test-utils').mockComponents({
  ActionRow: {
    Spacer: 'Spacer',
  },
  IconButton: 'IconButton',
  Icon: 'Icon',
}));
jest.mock('@edx/paragon/icons', () => ({
  Close: 'Close',
  ThumbUpOutline: 'ThumbUpOutline',
  ThumbDownOffAlt: 'ThumbDownOffAlt',
}));
jest.mock('./useFeedbackWidget', () => () => ({
  closeFeedbackWidget: jest.fn().mockName('closeFeedbackWidget'),
  openFeedbackWidget: jest.fn().mockName('openFeedbackWidget'),
  sendFeedback: jest.fn().mockName('sendFeedback'),
  showFeedbackWidget: true,
  showGratitudeText: false,
}));
jest.mock('@edx/frontend-platform/i18n', () => {
  const i18n = jest.requireActual('@edx/frontend-platform/i18n');
  const { formatMessage } = jest.requireActual('@edx/react-unit-test-utils');
  // this provide consistent for the test on different platform/timezone
  const formatDate = jest.fn(date => new Date(date).toISOString()).mockName('useIntl.formatDate');
  return {
    ...i18n,
    useIntl: jest.fn(() => ({
      formatMessage,
      formatDate,
    })),
    defineMessages: m => m,
    FormattedMessage: () => 'FormattedMessage',
  };
});

describe('<FeedbackWidget />', () => {
  const props = {
    courseId: 'course-v1:edX+DemoX+Demo_Course',
    languageCode: 'es',
    unitId: 'block-v1:edX+DemoX+Demo_Course+type@vertical+block@37b72b3915204b70acb00c55b604b563',
    userId: '123',
  };
  it('renders', () => {
    const wrapper = shallow(<FeedbackWidget {...props} />);
    expect(wrapper.snapshot).toMatchSnapshot();
  });
});

import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { Factory } from 'rosie';

import {
  initializeMockApp,
  initializeTestStore,
  render,
  screen,
} from '../../../setupTest';

import Chat from './Chat';

// We do a partial mock to avoid mocking out other exported values (e.g. the reducer).
// We mock out the Xpert component, because the Xpert component has its own rules for whether it renders
// or not, and this includes the results of API calls it makes. We don't want to test those rules here, just
// whether the Xpert is rendered by the Chat component in certain conditions. Instead of actually rendering
// Xpert, we render and assert on a mocked component.
const mockXpertTestId = 'xpert';

jest.mock('@edx/frontend-lib-learning-assistant', () => {
  const originalModule = jest.requireActual('@edx/frontend-lib-learning-assistant');

  return {
    __esModule: true,
    ...originalModule,
    Xpert: () => (<div data-testid={mockXpertTestId}>mocked Xpert</div>),
  };
});

initializeMockApp();

const courseId = 'course-v1:edX+DemoX+Demo_Course';
let testCases = [];
let enabledTestCases = [];
let disabledTestCases = [];
const enabledModes = [
  'professional', 'verified', 'no-id-professional', 'credit', 'masters', 'executive-education',
  'paid-executive-education', 'paid-bootcamp',
];
const disabledModes = [null, undefined, 'xyz', 'audit', 'honor', 'unpaid-executive-education', 'unpaid-bootcamp'];

describe('Chat', () => {
  let store;

  beforeAll(async () => {
    store = await initializeTestStore({
      specialExams: {
        activeAttempt: {
          attempt_id: null,
        },
        exam: {
          id: null,
        },
      },
    });
  });

  // Generate test cases.
  enabledTestCases = enabledModes.map((mode) => ({ enrollmentMode: mode, isVisible: true }));
  disabledTestCases = disabledModes.map((mode) => ({ enrollmentMode: mode, isVisible: false }));
  testCases = enabledTestCases.concat(disabledTestCases);

  testCases.forEach(test => {
    it(
      `visibility determined by ${test.enrollmentMode} enrollment mode when enabled and not isStaff`,
      async () => {
        render(
          <BrowserRouter>
            <Chat
              enrollmentMode={test.enrollmentMode}
              isStaff={false}
              enabled
              courseId={courseId}
              contentToolsEnabled={false}
            />
          </BrowserRouter>,
          { store },
        );

        const portal = screen.queryByTestId('xpert-portal');

        if (test.isVisible) {
          expect(portal).toBeInTheDocument();
          expect(await screen.findByTestId(mockXpertTestId)).toBeInTheDocument();
        } else {
          expect(portal).not.toBeInTheDocument();
        }
      },
    );
  });

  // Generate test cases.
  testCases = enabledModes.concat(disabledModes).map((mode) => ({ enrollmentMode: mode, isVisible: true }));
  testCases.forEach(test => {
    it('visibility determined by isStaff when enabled and any enrollment mode', async () => {
      render(
        <BrowserRouter>
          <Chat
            enrollmentMode={test.enrollmentMode}
            isStaff
            enabled
            courseId={courseId}
            contentToolsEnabled={false}
          />
        </BrowserRouter>,
        { store },
      );

      const chat = screen.queryByTestId(mockXpertTestId);
      if (test.isVisible) {
        expect(chat).toBeInTheDocument();
      } else {
        expect(chat).not.toBeInTheDocument();
      }
    });
  });

  // Generate the map function used for generating test cases by currying the map function.
  // In this test suite, visibility depends on whether the enrollment mode is a valid or invalid
  // enrollment mode for enabling the Chat when the user is not a staff member and the Chat is enabled. Instead of
  // defining two separate map functions that differ in only one case, curry the function.
  const generateMapFunction = (areEnabledModes) => (
    (mode) => (
      [
        {
          enrollmentMode: mode, isStaff: true, enabled: true, isVisible: true,
        },
        {
          enrollmentMode: mode, isStaff: true, enabled: false, isVisible: false,
        },
        {
          enrollmentMode: mode, isStaff: false, enabled: true, isVisible: areEnabledModes,
        },
        {
          enrollmentMode: mode, isStaff: false, enabled: false, isVisible: false,
        },
      ]
    )
  );

  // Generate test cases.
  enabledTestCases = enabledModes.map(generateMapFunction(true));
  disabledTestCases = disabledModes.map(generateMapFunction(false));
  testCases = enabledTestCases.concat(disabledTestCases);
  testCases = testCases.flat();
  testCases.forEach(test => {
    it(
      `visibility determined by ${test.enabled} enabled when ${test.isStaff} isStaff
      and ${test.enrollmentMode} enrollment mode`,
      async () => {
        render(
          <BrowserRouter>
            <Chat
              enrollmentMode={test.enrollmentMode}
              isStaff={test.isStaff}
              enabled={test.enabled}
              courseId={courseId}
              contentToolsEnabled={false}
            />
          </BrowserRouter>,
          { store },
        );

        const chat = screen.queryByTestId(mockXpertTestId);
        if (test.isVisible) {
          expect(chat).toBeInTheDocument();
        } else {
          expect(chat).not.toBeInTheDocument();
        }
      },
    );
  });

  it('if course end date has passed, component should not be visible', async () => {
    store = await initializeTestStore({
      specialExams: {
        activeAttempt: {
          attempt_id: 1,
        },
      },
      courseMetadata: Factory.build('courseMetadata', {
        start: '2014-02-03T05:00:00Z',
        end: '2014-02-05T05:00:00Z',
      }),
    });

    render(
      <BrowserRouter>
        <Chat
          enrollmentMode="verified"
          isStaff
          enabled
          courseId={courseId}
          contentToolsEnabled={false}
        />
      </BrowserRouter>,
      { store },
    );

    const chat = screen.queryByTestId(mockXpertTestId);
    expect(chat).not.toBeInTheDocument();
  });

  it('if learner has active exam attempt, component should not be visible', async () => {
    store = await initializeTestStore({
      specialExams: {
        activeAttempt: {
          attempt_id: 1,
        },
      },
    });

    render(
      <BrowserRouter>
        <Chat
          enrollmentMode="verified"
          isStaff
          enabled
          courseId={courseId}
          contentToolsEnabled={false}
        />
      </BrowserRouter>,
      { store },
    );

    const chat = screen.queryByTestId(mockXpertTestId);
    expect(chat).toBeInTheDocument();
  });
});

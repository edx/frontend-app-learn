import { getConfig, history } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { AppProvider } from '@edx/frontend-platform/react';
import { waitForElementToBeRemoved, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Route, Switch } from 'react-router';
import { Factory } from 'rosie';
import MockAdapter from 'axios-mock-adapter';

import { UserMessagesProvider } from '../generic/user-messages';
import tabMessages from '../tab-page/messages';
import { initializeMockApp } from '../setupTest';

import CoursewareContainer from './CoursewareContainer';
import { buildSimpleCourseBlocks, buildBinaryCourseBlocks } from '../shared/data/__factories__/courseBlocks.factory';
import initializeStore from '../store';
import { appendBrowserTimezoneToUrl } from '../utils';

// NOTE: Because the unit creates an iframe, we choose to mock it out as its rendering isn't
// pertinent to this test.  Instead, we render a simple div that displays the properties we expect
// to have been passed into the component.  Separate tests can handle unit rendering, but this
// proves that the component is rendered and receives the correct props.  We probably COULD render
// Unit.jsx and its iframe in this test, but it's already complex enough.
function MockUnit({ courseId, id }) { // eslint-disable-line react/prop-types
  return (
    <div className="fake-unit">Unit Contents {courseId} {id}</div>
  );
}

jest.mock(
  './course/sequence/Unit',
  () => MockUnit,
);

jest.mock('@edx/frontend-platform/analytics');

initializeMockApp();

describe('CoursewareContainer', () => {
  let store;
  let component;
  let axiosMock;

  // This is a standard set of data that can be used in CoursewareContainer tests.
  // By default, `setUpMockRequests()` will configure the mock LMS API to return use this data.
  // Certain test cases override these in order to test with special blocks/metadata.
  const defaultCourseMetadata = Factory.build('courseMetadata');
  const defaultCourseId = defaultCourseMetadata.id;
  const defaultUnitBlocks = [
    Factory.build(
      'block',
      { type: 'vertical' },
      { courseId: defaultCourseId },
    ),
    Factory.build(
      'block',
      { type: 'vertical' },
      { courseId: defaultCourseId },
    ),
    Factory.build(
      'block',
      { type: 'vertical' },
      { courseId: defaultCourseId },
    ),
  ];
  const {
    courseBlocks: defaultCourseBlocks,
    sequenceBlocks: [defaultSequenceBlock],
  } = buildSimpleCourseBlocks(
    defaultCourseId,
    defaultCourseMetadata.name,
    { unitBlocks: defaultUnitBlocks },
  );

  beforeEach(() => {
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());

    store = initializeStore();

    component = (
      <AppProvider store={store}>
        <UserMessagesProvider>
          <Switch>
            <Route
              path={[
                '/c/:courseId/:sequenceId/:unitId',
                '/c/:courseId/:sequenceId',
                '/c/:courseId',
              ]}
              component={CoursewareContainer}
            />
          </Switch>
        </UserMessagesProvider>
      </AppProvider>
    );
  });

  function setUpMockRequests(options = {}) {
    // If we weren't given course blocks or metadata, use the defaults.
    const courseBlocks = options.courseBlocks || defaultCourseBlocks;
    const courseMetadata = options.courseMetadata || defaultCourseMetadata;
    const courseId = courseMetadata.id;
    // If we weren't given a list of sequence metadatas for URL mocking,
    // then construct it ourselves by looking at courseBlocks.
    const sequenceMetadatas = options.sequenceMetadatas || (
      Object.values(courseBlocks.blocks)
        .filter(block => block.type === 'sequential')
        .map(sequenceBlock => Factory.build(
          'sequenceMetadata',
          {},
          {
            courseId,
            sequenceBlock,
            unitBlocks: sequenceBlock.children.map(unitId => courseBlocks.blocks[unitId]),
          },
        ))
    );

    const courseBlocksUrlRegExp = new RegExp(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/*`);
    axiosMock.onGet(courseBlocksUrlRegExp).reply(200, courseBlocks);

    const learningSequencesUrlRegExp = new RegExp(`${getConfig().LMS_BASE_URL}/api/learning_sequences/v1/course_outline/*`);
    axiosMock.onGet(learningSequencesUrlRegExp).reply(403, {});

    const courseMetadataUrl = appendBrowserTimezoneToUrl(`${getConfig().LMS_BASE_URL}/api/courseware/course/${courseId}`);
    axiosMock.onGet(courseMetadataUrl).reply(200, courseMetadata);

    sequenceMetadatas.forEach(sequenceMetadata => {
      const sequenceMetadataUrl = `${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceMetadata.hash_key}`;
      axiosMock.onGet(sequenceMetadataUrl).reply(200, sequenceMetadata);
      const sequenceMetadataUrlFull = `${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceMetadata.item_id}`;
      axiosMock.onGet(sequenceMetadataUrlFull).reply(200, sequenceMetadata);
      const proctoredExamApiUrl = `${getConfig().LMS_BASE_URL}/api/edx_proctoring/v1/proctored_exam/attempt/course_id/${courseId}/content_id/${sequenceMetadata.item_id}?is_learning_mfe=true`;
      axiosMock.onGet(proctoredExamApiUrl).reply(200, { exam: {}, active_attempt: {} });
    });
  }

  async function loadContainer() {
    const { container } = render(component);
    // Wait for the page spinner to be removed, such that we can wait for our main
    // content to load before making any assertions.
    await waitForElementToBeRemoved(screen.getByRole('status'));
    return container;
  }

  it('should initialize to show a spinner', () => {
    history.push('/c/abc123');
    render(component);

    const spinner = screen.getByRole('status');

    expect(spinner.firstChild).toContainHTML(
      `<span class="sr-only">${tabMessages.loading.defaultMessage}</span>`,
    );
  });

  describe('when receiving successful course data', () => {
    const courseMetadata = defaultCourseMetadata;
    const courseId = defaultCourseId;

    function assertLoadedHeader(container) {
      const courseHeader = container.querySelector('.course-header');
      // Ensure the course number and org appear - this proves we loaded course metadata properly.
      expect(courseHeader).toHaveTextContent(courseMetadata.number);
      expect(courseHeader).toHaveTextContent(courseMetadata.org);
      // Ensure the course title is showing up in the header.  This means we loaded course blocks properly.
      expect(courseHeader.querySelector('.course-title')).toHaveTextContent(courseMetadata.name);
    }

    function assertSequenceNavigation(container, expectedUnitCount = 3) {
      // Ensure we had appropriate sequence navigation buttons.  We should only have one unit.
      const sequenceNavButtons = container.querySelectorAll('nav.sequence-navigation button');
      expect(sequenceNavButtons).toHaveLength(expectedUnitCount + 2);

      expect(sequenceNavButtons[0]).toHaveTextContent('Previous');
      // Prove this button is rendering an SVG tasks icon, meaning it's a unit/vertical.
      expect(sequenceNavButtons[1].querySelector('svg')).toHaveClass('fa-tasks');
      expect(sequenceNavButtons[sequenceNavButtons.length - 1]).toHaveTextContent('Next');
    }

    beforeEach(async () => {
      // On page load, SequenceContext attempts to scroll to the top of the page.
      global.scrollTo = jest.fn();
      setUpMockRequests();
    });

    describe('when the URL only contains a course ID', () => {
      const sequenceBlock = defaultSequenceBlock;
      const unitBlocks = defaultUnitBlocks;

      it('should use the resume block repsonse to pick a unit if it contains one', async () => {
        axiosMock.onGet(`${getConfig().LMS_BASE_URL}/api/courseware/resume/${courseId}`).reply(200, {
          sectionId: sequenceBlock.hash_key,
          unitId: unitBlocks[1].hash_key,
        });

        history.push(`/c/${courseId}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container);

        expect(container.querySelector('.fake-unit')).toHaveTextContent('Unit Contents');
        expect(container.querySelector('.fake-unit')).toHaveTextContent(courseId);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitBlocks[1].hash_key);
      });

      it('should use the first sequence ID and activeUnitIndex if the resume block response is empty', async () => {
        // set the position to the third unit so we can prove activeUnitIndex is working
        const sequenceMetadata = Factory.build(
          'sequenceMetadata',
          { position: 3 }, // position index is 1-based and is converted to 0-based for activeUnitIndex
          { courseId, unitBlocks, sequenceBlock },
        );
        setUpMockRequests({ sequenceMetadatas: [sequenceMetadata] });

        // Note how there is no sectionId/unitId returned in this mock response!
        axiosMock.onGet(`${getConfig().LMS_BASE_URL}/api/courseware/resume/${courseId}`).reply(200, {});

        history.push(`/c/${courseId}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container);

        expect(container.querySelector('.fake-unit')).toHaveTextContent('Unit Contents');
        expect(container.querySelector('.fake-unit')).toHaveTextContent(courseId);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitBlocks[2].id);
      });
    });

    describe('when the URL contains a section ID instead of a sequence ID', () => {
      const {
        courseBlocks, unitTree, sequenceTree, sectionTree,
      } = buildBinaryCourseBlocks(
        courseId, courseMetadata.name,
      );

      function setUrl(urlSequenceId, urlUnitId = null) {
        history.push(`/c/${courseId}/${urlSequenceId}/${urlUnitId || ''}`);
      }

      function assertLocation(container, sequenceId, unitId) {
        const expectedUrl = `http://localhost/c/${courseId}/${sequenceId}/${unitId}`;
        expect(global.location.href).toEqual(expectedUrl);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitId);
      }

      beforeEach(async () => {
        setUpMockRequests({ courseBlocks });
      });

      describe('when the URL contains a unit ID', () => {
        it('should ignore the section ID and redirect based on the unit ID', async () => {
          const urlUnit = unitTree[1][1][1];
          setUrl(sectionTree[1].id, urlUnit.id);
          const container = await loadContainer();
          assertLoadedHeader(container);
          assertSequenceNavigation(container, 2);
          assertLocation(container, sequenceTree[1][1].hash_key, urlUnit.hash_key);
        });
      });

      describe('when the URL does not contain a unit ID', () => {
        it('should choose a unit within the section\'s first sequence', async () => {
          setUrl(sectionTree[1].id);
          const container = await loadContainer();
          assertLoadedHeader(container);
          assertSequenceNavigation(container, 2);
          assertLocation(container, sequenceTree[1][0].hash_key, unitTree[1][0][0].hash_key);
        });
      });

      describe('when the section is empty', () => {
        // Make a (shallow-)copy of the course blocks.
        // Remove all descendents of the second section.
        const blocksWithEmptySection = { ...courseBlocks.blocks };
        blocksWithEmptySection[sectionTree[1].id] = {
          ...sectionTree[1],
          children: [],
        };
        sequenceTree[1].forEach(sequence => { delete blocksWithEmptySection[sequence.id]; });
        unitTree[1].flat().forEach(unit => { delete blocksWithEmptySection[unit.id]; });
        const courseBlocksWithEmptySection = {
          ...courseBlocks,
          blocks: blocksWithEmptySection,
        };

        beforeEach(async () => {
          setUpMockRequests({ courseBlocks: courseBlocksWithEmptySection });
        });

        it('should ignore the section ID and instead redirect to the course root', async () => {
          setUrl(sectionTree[1].id);
          await loadContainer();
          expect(global.location.href).toEqual(`http://localhost/c/${courseId}`);
        });

        it('should ignore the section and unit IDs and instead to the course root', async () => {
          // Specific unit ID used here shouldn't matter; is ignored due to empty section.
          setUrl(sectionTree[1].id, unitTree[0][0][0]);
          await loadContainer();
          expect(global.location.href).toEqual(`http://localhost/c/${courseId}`);
        });
      });
    });

    describe('when the URL only contains a unit ID', () => {
      const { courseBlocks, unitTree, sequenceTree } = buildBinaryCourseBlocks(courseId, courseMetadata.name);

      beforeEach(async () => {
        setUpMockRequests({ courseBlocks });
      });

      it('should insert the sequence ID into the URL', async () => {
        const unit = unitTree[1][0][1];
        history.push(`/c/${courseId}/${unit.id}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container, 2);
        const expectedSequenceId = sequenceTree[1][0].hash_key;
        const expectedUrl = `http://localhost/c/${courseId}/${expectedSequenceId}/${unit.hash_key}`;
        expect(global.location.href).toEqual(expectedUrl);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unit.hash_key);
      });
    });

    describe('when the URL contains a course ID and sequence ID', () => {
      const sequenceBlock = defaultSequenceBlock;
      const unitBlocks = defaultUnitBlocks;

      it('should pick the first unit if position was not defined (activeUnitIndex becomes 0)', async () => {
        history.push(`/c/${courseId}/${sequenceBlock.hash_key}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container);

        expect(container.querySelector('.fake-unit')).toHaveTextContent('Unit Contents');
        expect(container.querySelector('.fake-unit')).toHaveTextContent(courseId);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitBlocks[0].hash_key);
      });

      it('should use activeUnitIndex to pick a unit from the sequence', async () => {
        const sequenceMetadata = Factory.build(
          'sequenceMetadata',
          { position: 3 }, // position index is 1-based and is converted to 0-based for activeUnitIndex
          { courseId, unitBlocks, sequenceBlock },
        );
        setUpMockRequests({ sequenceMetadatas: [sequenceMetadata] });

        history.push(`/c/${courseId}/${sequenceBlock.hash_key}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container);

        expect(container.querySelector('.fake-unit')).toHaveTextContent('Unit Contents');
        expect(container.querySelector('.fake-unit')).toHaveTextContent(courseId);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitBlocks[2].hash_key);
      });
    });

    describe('when the URL contains a course, sequence, and unit ID', () => {
      const sequenceBlock = defaultSequenceBlock;
      const unitBlocks = defaultUnitBlocks;

      it('should load the specified unit', async () => {
        history.push(`/c/${courseId}/${sequenceBlock.hash_key}/${unitBlocks[2].hash_key}`);
        const container = await loadContainer();

        assertLoadedHeader(container);
        assertSequenceNavigation(container);

        expect(container.querySelector('.fake-unit')).toHaveTextContent('Unit Contents');
        expect(container.querySelector('.fake-unit')).toHaveTextContent(courseId);
        expect(container.querySelector('.fake-unit')).toHaveTextContent(unitBlocks[2].hash_key);
      });

      it('should navigate between units and check block completion', async () => {
        axiosMock.onPost(`${courseId}/xblock/${sequenceBlock.id}/handler/get_completion`).reply(200, {
          complete: true,
        });

        history.push(`/c/${courseId}/${sequenceBlock.hash_key}/${unitBlocks[0].id}`);
        const container = await loadContainer();

        const sequenceNavButtons = container.querySelectorAll('nav.sequence-navigation button');
        const sequenceNextButton = sequenceNavButtons[4];
        expect(sequenceNextButton).toHaveTextContent('Next');
        fireEvent.click(sequenceNavButtons[4]);

        expect(global.location.href).toEqual(`http://localhost/c/${courseId}/${sequenceBlock.hash_key}/${unitBlocks[1].id}`);
      });
    });

    describe('when the current sequence is an exam', () => {
      const { location } = window;
      const sequenceBlock = defaultSequenceBlock;
      const unitBlocks = defaultUnitBlocks;

      beforeEach(() => {
        delete window.location;
        window.location = {
          assign: jest.fn(),
        };
      });

      afterEach(() => {
        window.location = location;
      });

      it('should redirect to the sequence legacyWebUrl', async () => {
        const sequenceMetadata = Factory.build(
          'sequenceMetadata',
          { is_time_limited: true }, // position index is 1-based and is converted to 0-based for activeUnitIndex
          { courseId, unitBlocks, sequenceBlock },
        );
        setUpMockRequests({ sequenceMetadatas: [sequenceMetadata] });

        history.push(`/c/${courseId}/${sequenceBlock.hash_key}/${unitBlocks[2].hash_key}`);
        await loadContainer();

        expect(global.location.assign).toHaveBeenCalledWith(sequenceBlock.legacy_web_url);
      });
    });
  });

  describe('when receiving a course_access error_code', () => {
    function setUpWithDeniedStatus(errorCode) {
      const courseMetadata = Factory.build('courseMetadata', {
        course_access: {
          has_access: false,
          error_code: errorCode,
          additional_context_user_message: 'uhoh oh no', // only used by audit_expired
        },
      });
      const courseId = courseMetadata.id;

      const { courseBlocks, sequenceBlocks, unitBlocks } = buildSimpleCourseBlocks(courseId, courseMetadata.name);
      setUpMockRequests({ courseBlocks, courseMetadata });
      history.push(`/c/${courseId}/${sequenceBlocks[0].hash_key}/${unitBlocks[0].hash_key}`);
      return { courseMetadata, unitBlocks };
    }

    it('should go to course home for an enrollment_required error code', async () => {
      const { courseMetadata } = setUpWithDeniedStatus('enrollment_required');
      await loadContainer();

      expect(global.location.href).toEqual(`http://localhost/redirect/course-home/${courseMetadata.id}`);
    });

    it('should go to course survey for a survey_required error code', async () => {
      const { courseMetadata } = setUpWithDeniedStatus('survey_required');
      await loadContainer();

      expect(global.location.href).toEqual(`http://localhost/redirect/survey/${courseMetadata.id}`);
    });

    it('should go to legacy courseware for a microfrontend_disabled error code', async () => {
      const { courseMetadata, unitBlocks } = setUpWithDeniedStatus('microfrontend_disabled');
      await loadContainer();

      expect(global.location.href).toEqual(`http://localhost/redirect/courseware/${courseMetadata.id}/unit/${unitBlocks[0].id}`);
    });

    it('should go to course home for an authentication_required error code', async () => {
      const { courseMetadata } = setUpWithDeniedStatus('authentication_required');
      await loadContainer();

      expect(global.location.href).toEqual(`http://localhost/redirect/course-home/${courseMetadata.id}`);
    });

    it('should go to dashboard for an unfulfilled_milestones error code', async () => {
      setUpWithDeniedStatus('unfulfilled_milestones');
      await loadContainer();

      expect(global.location.href).toEqual('http://localhost/redirect/dashboard');
    });

    it('should go to the dashboard with an attached access_response_error for an audit_expired error code', async () => {
      setUpWithDeniedStatus('audit_expired');
      await loadContainer();

      expect(global.location.href).toEqual('http://localhost/redirect/dashboard?access_response_error=uhoh%20oh%20no');
    });

    it('should go to the dashboard with a notlive start date for a course_not_started error code', async () => {
      setUpWithDeniedStatus('course_not_started');
      await loadContainer();

      const startDate = '2/5/2013'; // This date is based on our courseMetadata factory's sample data.
      expect(global.location.href).toEqual(`http://localhost/redirect/dashboard?notlive=${startDate}`);
    });
  });
});

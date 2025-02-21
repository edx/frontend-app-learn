import { AppProvider } from '@edx/frontend-platform/react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { sendTrackEvent, sendTrackingLogEvent } from '@edx/frontend-platform/analytics';

import { initializeMockApp, initializeTestStore } from '@src/setupTest';
import SidebarUnit from './SidebarUnit';
import SidebarContext from '../../../SidebarContext';
import { ID } from '../constants';

jest.mock('@edx/frontend-platform/analytics', () => ({
  sendTrackEvent: jest.fn(),
  sendTrackingLogEvent: jest.fn(),
}));

initializeMockApp();

describe('<SidebarUnit />', () => {
  let store = {};
  let unit;
  let sequenceId;

  // A default context for desktop mode.
  const defaultSidebarContext = {
    toggleSidebar: jest.fn(),
    shouldDisplayFullScreen: false,
    currentSidebar: ID,
  };

  const initTestStore = async (options) => {
    store = await initializeTestStore(options);
    const state = store.getState();
    [sequenceId] = Object.keys(state.courseware.courseOutline.sequences);
    const sequence = state.courseware.courseOutline.sequences[sequenceId];
    unit = state.courseware.courseOutline.units[sequence.unitIds[0]];
  };

  function renderWithProvider(props = {}, sidebarContext = defaultSidebarContext) {
    const { container } = render(
      <AppProvider store={store} wrapWithRouter={false}>
        <IntlProvider locale="en">
          <MemoryRouter>
            <SidebarContext.Provider value={sidebarContext}>
              <SidebarUnit
                isFirst
                id={unit.id}
                courseId="course123"
                sequenceId={sequenceId}
                unit={{ ...unit, icon: 'video', isLocked: false }}
                isActive={false}
                activeUnitId={unit.id}
                {...props}
              />
            </SidebarContext.Provider>
          </MemoryRouter>
        </IntlProvider>
      </AppProvider>,
    );
    return container;
  }

  it('renders correctly when unit is incomplete', async () => {
    await initTestStore();
    const container = renderWithProvider();

    expect(screen.getByText(unit.title)).toBeInTheDocument();
    expect(container.querySelector('.text-success')).not.toBeInTheDocument();
  });

  it('renders correctly when unit is complete', async () => {
    await initTestStore();
    const container = renderWithProvider({ unit: { ...unit, complete: true } });

    expect(screen.getByText(unit.title)).toBeInTheDocument();
    expect(container.querySelector('.text-success')).toBeInTheDocument();
    expect(container.querySelector('.border-top')).not.toBeInTheDocument();
  });

  it('renders correctly when unit is not first and icon is not set', async () => {
    await initTestStore();
    const container = renderWithProvider({
      isFirst: false,
      unit: { ...unit, icon: null },
    });

    expect(screen.getByText(unit.title)).toBeInTheDocument();
    expect(container.querySelector('.border-top')).toBeInTheDocument();
  });

  it('renders correctly when unit is locked', async () => {
    await initTestStore();
    renderWithProvider({
      unit: { ...unit, isLocked: true },
    });

    expect(screen.getByText(unit.title)).toBeInTheDocument();
  });

  describe('When a unit is clicked', () => {
    it('sends log event correctly', async () => {
      const user = userEvent.setup();
      await initTestStore();
      renderWithProvider({ unit: { ...unit } });
      const logData = {
        id: unit.id,
        current_tab: 1,
        tab_count: 1,
        target_id: unit.id,
        target_tab: 1,
        widget_placement: 'left',
      };

      await user.click(screen.getByText(unit.title));

      expect(sendTrackEvent).toHaveBeenCalledWith('edx.ui.lms.sequence.tab_selected', logData);
      expect(sendTrackingLogEvent).toHaveBeenCalledWith('edx.ui.lms.sequence.tab_selected', logData);
    });

    it('leaves sidebar open in desktop mode', async () => {
      const user = userEvent.setup();
      await initTestStore();
      renderWithProvider({ unit: { ...unit } });
      await user.click(screen.getByText(unit.title));

      expect(defaultSidebarContext.toggleSidebar).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('hideCourseOutlineSidebar')).toBeNull();
    });

    it('closes sidebar on mobile devices', async () => {
      const user = userEvent.setup();
      await initTestStore();
      renderWithProvider({ unit: { ...unit } }, { ...defaultSidebarContext, shouldDisplayFullScreen: true });
      await user.click(screen.getByText(unit.title));

      expect(defaultSidebarContext.toggleSidebar).toHaveBeenCalledTimes(1);
      expect(defaultSidebarContext.toggleSidebar).toHaveBeenCalledWith(null);
      expect(window.sessionStorage.getItem('hideCourseOutlineSidebar')).toEqual('true');
    });
  });
});

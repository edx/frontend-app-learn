import React from 'react';
import { history } from '@edx/frontend-platform';

import {
  fireEvent, initializeTestStore, render, screen,
} from '../../../../setupTest';
import HonorCode from './HonorCode';

jest.mock('@edx/frontend-platform', () => ({
  ...jest.requireActual('@edx/frontend-platform'),
  history: {
    push: jest.fn(),
  },
}));

describe('Honor Code', () => {
  let store;
  const mockData = {};

  beforeAll(async () => {
    store = await initializeTestStore();
    const { courseware } = store.getState();
    mockData.courseId = courseware.courseId;
  });

  it('cancel button links to course home ', () => {
    render(<HonorCode {...mockData} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(history.push).toHaveBeenCalledWith(`/c/${mockData.courseId}/home`);
  });
});

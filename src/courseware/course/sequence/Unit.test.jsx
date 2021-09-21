import React from 'react';
import { Factory } from 'rosie';
import {
  initializeTestStore, loadUnit, messageEvent, render, screen, waitFor,
} from '../../../setupTest';
import Unit, { sendUrlHashToFrame } from './Unit';

describe('Unit', () => {
  let mockData;
  const courseMetadata = Factory.build(
    'courseMetadata',
    { content_type_gating_enabled: true },
  );
  const courseMetadataNeedsSignature = Factory.build(
    'courseMetadata',
    { user_needs_integrity_signature: true },
  );
  const unitBlocks = [
    Factory.build(
      'block',
      { type: 'problem', graded: 'true' },
      { courseId: courseMetadata.id },
    ), Factory.build(
      'block',
      {
        type: 'vertical',
        contains_content_type_gated_content: true,
        bookmarked: true,
        graded: true,
      },
      { courseId: courseMetadata.id },
    ),
    Factory.build(
      'block',
      { type: 'problem', graded: false },
      { courseId: courseMetadata.id },
    ),
  ];
  const [unit, unitThatContainsGatedContent, ungradedUnit] = unitBlocks;

  beforeAll(async () => {
    await initializeTestStore({ courseMetadata, unitBlocks });
    mockData = {
      id: unit.id,
      courseId: courseMetadata.id,
      format: 'Homework',
      decoded_id: unit.decoded_id,
    };
  });

  it('renders correctly', () => {
    render(<Unit {...mockData} />);
    expect(screen.getByText('Loading learning sequence...')).toBeInTheDocument();
    const renderedUnit = screen.getByTitle(unit.display_name);
    expect(renderedUnit).toHaveAttribute('height', String(0));
    expect(renderedUnit).toHaveAttribute(
      'src', `http://localhost:18000/xblock/${mockData.decoded_id}?show_title=0&show_bookmark_button=0&recheck_access=1&view=student_view&format=${mockData.format}`,
    );
  });

  it('renders proper message for gated content', () => {
    render(<Unit {...mockData} id={unitThatContainsGatedContent.id} />);
    expect(screen.getByText('Loading learning sequence...')).toBeInTheDocument();
    expect(screen.getByText('Loading locked content messaging...')).toBeInTheDocument();
  });

  it('does not display HonorCode for ungraded units', async () => {
    const signatureStore = await initializeTestStore(
      { courseMetadata: courseMetadataNeedsSignature, unitBlocks },
      false,
    );
    const signatureData = {
      id: ungradedUnit.id,
      courseId: courseMetadataNeedsSignature.id,
      format: 'Homework',
    };
    render(<Unit {...signatureData} />, { store: signatureStore });
    expect(screen.getByText('Loading learning sequence...')).toBeInTheDocument();
  });

  it('displays HonorCode for graded units if user needs integrity signature', async () => {
    const signatureStore = await initializeTestStore(
      { courseMetadata: courseMetadataNeedsSignature, unitBlocks },
      false,
    );
    const signatureData = {
      id: unit.id,
      courseId: courseMetadataNeedsSignature.id,
      format: 'Homework',
    };
    render(<Unit {...signatureData} />, { store: signatureStore });
    expect(screen.getByText('Loading honor code messaging...')).toBeInTheDocument();
  });

  it('handles receiving MessageEvent', async () => {
    render(<Unit {...mockData} />);
    loadUnit();
    // Loading message is gone now.
    await waitFor(() => expect(screen.queryByText('Loading learning sequence...')).not.toBeInTheDocument());
    // Iframe's height is set via message.
    expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(messageEvent.payload.height));
  });

  it('calls onLoaded after receiving MessageEvent', async () => {
    const onLoaded = jest.fn();
    render(<Unit {...mockData} {...{ onLoaded }} />);
    loadUnit();

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
  });

  it('resizes iframe on second MessageEvent, does not call onLoaded again', async () => {
    const onLoaded = jest.fn();
    // Clone message and set different height.
    const testMessageWithOtherHeight = { ...messageEvent, payload: { height: 200 } };
    render(<Unit {...mockData} {...{ onLoaded }} />);
    loadUnit();

    await waitFor(() => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(messageEvent.payload.height)));
    window.postMessage(testMessageWithOtherHeight, '*');
    await waitFor(() => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(testMessageWithOtherHeight.payload.height)));
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('scrolls page on MessagaeEvent when receiving offset', async () => {
    // Set message to constain offset data.
    const testMessageWithOffset = { offset: 1500 };
    render(<Unit {...mockData} />);
    window.postMessage(testMessageWithOffset, '*');

    await expect(waitFor(() => expect(window.scrollTo()).toHaveBeenCalled()));
    expect(window.scrollY === testMessageWithOffset.offset);
  });

  it('ignores MessageEvent with unhandled type', async () => {
    // Clone message and set different type.
    const testMessageWithUnhandledType = { ...messageEvent, type: 'wrong type' };
    render(<Unit {...mockData} />);
    window.postMessage(testMessageWithUnhandledType, '*');

    // HACK: We don't have a function we could reliably await here, so this test relies on the timeout of `waitFor`.
    await expect(waitFor(
      () => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(testMessageWithUnhandledType.payload.height)),
      { timeout: 100 },
    )).rejects.toThrowError(/Expected the element to have attribute/);
  });

  it('scrolls to correct place onLoad', () => {
    document.body.innerHTML = "<iframe id='unit-iframe' />";

    const mockHashCheck = jest.fn(frameVar => sendUrlHashToFrame(frameVar));
    const frame = document.getElementById('unit-iframe');
    const originalWindow = { ...window };
    const windowSpy = jest.spyOn(global, 'window', 'get');
    windowSpy.mockImplementation(() => ({
      ...originalWindow,
      location: {
        ...originalWindow.location,
        hash: '#test',
      },
    }));
    const messageSpy = jest.spyOn(frame.contentWindow, 'postMessage');
    messageSpy.mockImplementation(() => ({ hashName: originalWindow.location.hash }));
    mockHashCheck(frame);

    expect(mockHashCheck).toHaveBeenCalled();
    expect(messageSpy).toHaveBeenCalled();

    windowSpy.mockRestore();
  });

  it('calls useEffect and checkForHash', () => {
    const mockHashCheck = jest.fn(() => sendUrlHashToFrame());
    const effectSpy = jest.spyOn(React, 'useEffect');
    effectSpy.mockImplementation(() => mockHashCheck());
    render(<Unit {...mockData} />);
    expect(React.useEffect).toHaveBeenCalled();
    expect(mockHashCheck).toHaveBeenCalled();
  });
});

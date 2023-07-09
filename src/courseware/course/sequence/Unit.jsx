import { getConfig } from '@edx/frontend-platform';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { logError } from '@edx/frontend-platform/logging';
import { AppContext, ErrorPage } from '@edx/frontend-platform/react';
import { getExamAccess, fetchExamAccess, isExam } from '@edx/frontend-lib-special-exams';
import { ModalDialog, ActionRow } from '@edx/paragon';
import PropTypes from 'prop-types';
import React, {
  Suspense, useCallback, useContext, useEffect, useLayoutEffect, useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { processEvent } from '../../../course-home/data/thunks';
import { useEventListener } from '../../../generic/hooks';
import { useModel } from '../../../generic/model-store';
import PageLoading from '../../../generic/PageLoading';
import { fetchCourse } from '../../data';
import BookmarkButton from '../bookmark/BookmarkButton';
import ShareButton from '../share/ShareButton';
import messages from './messages';

const HonorCode = React.lazy(() => import('./honor-code'));
const LockPaywall = React.lazy(() => import('./lock-paywall'));

/**
 * Feature policy for iframe, allowing access to certain courseware-related media.
 *
 * We must use the wildcard (*) origin for each feature, as courseware content
 * may be embedded in external iframes. Notably, xblock-lti-consumer is a popular
 * block that iframes external course content.

 * This policy was selected in conference with the edX Security Working Group.
 * Changes to it should be vetted by them (security@edx.org).
 */
const IFRAME_FEATURE_POLICY = (
  'microphone *; camera *; midi *; geolocation *; encrypted-media *; clipboard-write *'
);

/**
 * We discovered an error in Firefox where - upon iframe load - React would cease to call any
 * useEffect hooks until the user interacts with the page again.  This is particularly confusing
 * when navigating between sequences, as the UI partially updates leaving the user in a nebulous
 * state.
 *
 * We were able to solve this error by using a layout effect to update some component state, which
 * executes synchronously on render.  Somehow this forces React to continue it's lifecycle
 * immediately, rather than waiting for user interaction.  This layout effect could be anywhere in
 * the parent tree, as far as we can tell - we chose to add a conspicuously 'load bearing' (that's
 * a joke) one here so it wouldn't be accidentally removed elsewhere.
 *
 * If we remove this hook when one of these happens:
 * 1. React figures out that there's an issue here and fixes a bug.
 * 2. We cease to use an iframe for unit rendering.
 * 3. Firefox figures out that there's an issue in their iframe loading and fixes a bug.
 * 4. We stop supporting Firefox.
 * 5. An enterprising engineer decides to create a repo that reproduces the problem, submits it to
 *    Firefox/React for review, and they kindly help us figure out what in the world is happening
 *    so  we can fix it.
 *
 * This hook depends on the unit id just to make sure it re-evaluates whenever the ID changes.  If
 * we change whether or not the Unit component is re-mounted when the unit ID changes, this may
 * become important, as this hook will otherwise only evaluate the useLayoutEffect once.
 */
function useLoadBearingHook(id) {
  const setValue = useState(0)[1];
  useLayoutEffect(() => {
    setValue(currentValue => currentValue + 1);
  }, [id]);
}

function addExamAccessToIframeUrl(accessToken, iframeUrl) {
  let url = iframeUrl;
  if (isExam()) {
    if (accessToken) {
      url += `&exam_access=${accessToken}`;
    }
  }
  return url;
}

export function sendUrlHashToFrame(frame) {
  const { hash } = window.location;
  if (hash) {
    // The url hash will be sent to LMS-served iframe in order to find the location of the
    // hash within the iframe.
    frame.contentWindow.postMessage({ hashName: hash }, `${getConfig().LMS_BASE_URL}`);
  }
}

const Unit = ({
  courseId,
  format,
  onLoaded,
  id,
  intl,
}) => {
  const { authenticatedUser } = useContext(AppContext);
  const view = authenticatedUser ? 'student_view' : 'public_view';

  let iframeUrl = `${getConfig().LMS_BASE_URL}/xblock/${id}?show_title=0&show_bookmark_button=0&recheck_access=1&view=${view}`;
  if (format) {
    iframeUrl += `&format=${format}`;
  }

  const [iframeHeight, setIframeHeight] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showError, setShowError] = useState(false);
  const [modalOptions, setModalOptions] = useState({ open: false });
  const [shouldDisplayHonorCode, setShouldDisplayHonorCode] = useState(false);
  const [examAccessToken, setExamAccessToken] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [blockExamAccess, setBlockExamAccess] = useState(isExam());
  const [windowTopOffset, setWindowTopOffset] = useState(null);

  const unit = useModel('units', id);
  const course = useModel('coursewareMeta', courseId);
  const {
    contentTypeGatingEnabled,
    userNeedsIntegritySignature,
  } = course;

  const dispatch = useDispatch();
  // Do not remove this hook.  See function description.
  useLoadBearingHook(id);

  useEffect(() => {
    if (userNeedsIntegritySignature && unit.graded) {
      setShouldDisplayHonorCode(true);
    } else {
      setShouldDisplayHonorCode(false);
    }
  }, [userNeedsIntegritySignature]);

  const receiveMessage = useCallback(({ data }) => {
    const {
      type,
      payload,
    } = data;
    if (type === 'plugin.resize') {
      setIframeHeight(payload.height);

      // We observe exit from the video xblock full screen mode
      // and do page scroll to the previously saved scroll position
      if (windowTopOffset !== null) {
        window.scrollTo(0, Number(windowTopOffset));
      }

      if (!hasLoaded && iframeHeight === 0 && payload.height > 0) {
        setHasLoaded(true);
        if (onLoaded) {
          onLoaded();
        }
      }
    } else if (type === 'plugin.modal') {
      payload.open = true;
      setModalOptions(payload);
    } else if (type === 'plugin.videoFullScreen') {
      // We listen for this message from LMS to know when we need to
      // save or reset scroll position on toggle video xblock full screen mode.
      setWindowTopOffset(payload.open ? window.scrollY : null);
    } else if (data.offset) {
      // We listen for this message from LMS to know when the page needs to
      // be scrolled to another location on the page.
      window.scrollTo(0, data.offset + document.getElementById('unit-iframe').offsetTop);
    }
  }, [id, setIframeHeight, hasLoaded, iframeHeight, setHasLoaded, onLoaded, setWindowTopOffset, windowTopOffset]);
  useEventListener('message', receiveMessage);
  useEffect(() => {
    sendUrlHashToFrame(document.getElementById('unit-iframe'));
  }, [id, setIframeHeight, hasLoaded, iframeHeight, setHasLoaded, onLoaded]);

  useEffect(() => {
    if (isExam()) {
      fetchExamAccess().finally(() => {
        const examAccess = getExamAccess();
        setExamAccessToken(examAccess);
        setBlockExamAccess(false);
      }).catch((error) => logError(error));
    }
  }, [id]);

  return (
    <div className="unit">
      <h1 className="mb-0 h3">{unit.title}</h1>
      <h2 className="sr-only">{intl.formatMessage(messages.headerPlaceholder)}</h2>
      <BookmarkButton
        unitId={unit.id}
        isBookmarked={unit.bookmarked}
        isProcessing={unit.bookmarkedUpdateState === 'loading'}
      />
      {/* TODO: social share exp. Need to remove later */}
      {(window.expSocialShareAboutUrls && window.expSocialShareAboutUrls[unit.id] !== undefined) && (
        <ShareButton url={window.expSocialShareAboutUrls[unit.id]} />
      )}
      {contentTypeGatingEnabled && unit.containsContentTypeGatedContent && (
        <Suspense
          fallback={(
            <PageLoading
              srMessage={intl.formatMessage(messages.loadingLockedContent)}
            />
          )}
        >
          <LockPaywall courseId={courseId} />
        </Suspense>
      )}
      {shouldDisplayHonorCode && (
        <Suspense
          fallback={(
            <PageLoading
              srMessage={intl.formatMessage(messages.loadingHonorCode)}
            />
          )}
        >
          <HonorCode courseId={courseId} />
        </Suspense>
      )}
      {!shouldDisplayHonorCode && !hasLoaded && !showError && (
        <PageLoading
          srMessage={intl.formatMessage(messages.loadingSequence)}
        />
      )}
      {!shouldDisplayHonorCode && !hasLoaded && showError && (
        <ErrorPage />
      )}
      {modalOptions.open && (
        <ModalDialog
          title="My dialog"
          isOpen
          onClose={() => { setModalOptions({ open: false }); }}
          isFullscreenOnMobile
          // size="xl"
          className="modal-lti"
          hasCloseButton
        >
          <ModalDialog.Body>
            <>
              {modalOptions.body
                ? <div className="unit-modal">{modalOptions.body}</div>
                : (
                  <>
                    <iframe
                      title={modalOptions.title}
                      allow={IFRAME_FEATURE_POLICY}
                      frameBorder="0"
                      src={modalOptions.url}
                      style={{
                        width: '100%',
                        height: '100vh',
                      }}
                    />
                  </>
                )}
            </>
          </ModalDialog.Body>

          <ModalDialog.Footer>
            <ActionRow>
              <ModalDialog.CloseButton variant="primary">
                Close
              </ModalDialog.CloseButton>
            </ActionRow>
          </ModalDialog.Footer>
        </ModalDialog>

      )}
      {!shouldDisplayHonorCode && (
        <div className="unit-iframe-wrapper">
          <iframe
            id="unit-iframe"
            title={unit.title}
            src={addExamAccessToIframeUrl(examAccessToken, iframeUrl)}
            allow={IFRAME_FEATURE_POLICY}
            allowFullScreen
            height={iframeHeight}
            scrolling="no"
            referrerPolicy="origin"
            onLoad={() => {
              // onLoad *should* only fire after everything in the iframe has finished its own load events.
              // Which means that the plugin.resize message (which calls setHasLoaded above) will have fired already
              // for a successful load. If it *has not fired*, we are in an error state. For example, the backend
              // could have given us a 4xx or 5xx response.
              if (!hasLoaded) {
                setShowError(true);
                logError('Unit iframe failed to load. Server possibly returned 4xx or 5xx response.', {
                  iframeUrl,
                });
              }

              window.onmessage = (e) => {
                if (e.data.event_name) {
                  dispatch(processEvent(e.data, fetchCourse));
                }
              };
            }}
          />
        </div>
      )}
    </div>
  );
};

Unit.propTypes = {
  courseId: PropTypes.string.isRequired,
  format: PropTypes.string,
  id: PropTypes.string.isRequired,
  intl: intlShape.isRequired,
  onLoaded: PropTypes.func,
};

Unit.defaultProps = {
  format: null,
  onLoaded: undefined,
};

export default injectIntl(Unit);

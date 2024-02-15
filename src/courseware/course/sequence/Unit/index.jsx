import PropTypes from 'prop-types';
import React from 'react';

import { AppContext } from '@edx/frontend-platform/react';
import { useIntl } from '@edx/frontend-platform/i18n';

import { ensureConfig, getConfig } from '@edx/frontend-platform';
import { useModel } from '../../../../generic/model-store';

import BookmarkButton from '../../bookmark/BookmarkButton';
import messages from '../messages';
import ContentIFrame from './ContentIFrame';
import UnitSuspense from './UnitSuspense';
import { modelKeys, views } from './constants';
import { useExamAccess, useShouldDisplayHonorCode, useLoadUnitChildren } from './hooks';
import { getIFrameUrl } from './urls';
import { XBlock } from '../XBlock';

ensureConfig(['RENDER_XBLOCKS_EXPERIMENTAL', 'RENDER_XBLOCKS_DEFAULT']);

const Unit = ({
  courseId,
  format,
  onLoaded,
  id,
}) => {
  const { formatMessage } = useIntl();
  const { authenticatedUser } = React.useContext(AppContext);
  const examAccess = useExamAccess({ id });
  const shouldDisplayHonorCode = useShouldDisplayHonorCode({ courseId, id });
  const unit = useModel(modelKeys.units, id);
  const isProcessing = unit.bookmarkedUpdateState === 'loading';
  const view = authenticatedUser ? views.student : views.public;
  const unitChildren = useLoadUnitChildren(id);

  const iframeUrl = getIFrameUrl({
    id,
    view,
    format,
    examAccess,
  });

  return (
    <div className="unit">
      <h1 className="mb-0 h3">{unit.title}</h1>
      <h2 className="sr-only">{formatMessage(messages.headerPlaceholder)}</h2>
      <BookmarkButton
        unitId={unit.id}
        isBookmarked={unit.bookmarked}
        isProcessing={isProcessing}
      />
      <UnitSuspense {...{ courseId, id }} />
      {getConfig().RENDER_XBLOCKS_DEFAULT !== false && getConfig().RENDER_XBLOCKS_DEFAULT !== 'false' && (
        <ContentIFrame
          elementId="unit-iframe"
          id={id}
          iframeUrl={iframeUrl}
          loadingMessage={formatMessage(messages.loadingSequence)}
          onLoaded={onLoaded}
          shouldShowContent={!shouldDisplayHonorCode && !examAccess.blockAccess}
          title={unit.title}
        />
      )}
      {(getConfig().RENDER_XBLOCKS_EXPERIMENTAL === true || getConfig().RENDER_XBLOCKS_EXPERIMENTAL === 'true')
        && unitChildren && unitChildren.map((child) => (
          <XBlock key={child} usageId={child} />
      ))}
    </div>
  );
};

Unit.propTypes = {
  courseId: PropTypes.string.isRequired,
  format: PropTypes.string,
  id: PropTypes.string.isRequired,
  onLoaded: PropTypes.func,
};

Unit.defaultProps = {
  format: null,
  onLoaded: undefined,
};

export default Unit;

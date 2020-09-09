import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { getConfig } from '@edx/frontend-platform';

import { ALERT_TYPES } from '../generic/user-messages';
import Alert from '../generic/user-messages/Alert';
import MasqueradeWidget from './masquerade-widget';

function getInsightsUrl(courseId) {
  const urlBase = getConfig().INSIGHTS_BASE_URL;
  let urlFull;
  if (urlBase) {
    urlFull = `${urlBase}/courses`;
    // This shouldn't actually be missing, at present,
    // but we're providing a reasonable fallback,
    // in case of either error or extension.
    if (courseId) {
      urlFull += `/${courseId}`;
    }
  }
  return urlFull;
}

function getStudioUrl(courseId, unitId) {
  const urlBase = getConfig().STUDIO_BASE_URL;
  let urlFull;
  if (urlBase) {
    if (unitId) {
      urlFull = `${urlBase}/container/${unitId}`;
    } else if (courseId) {
      urlFull = `{$urlBase}/course/${courseId}`;
    }
  }
  return urlFull;
}

export default function InstructorToolbar(props) {
  const {
    courseId,
    unitId,
  } = props;
  const urlInsights = getInsightsUrl(courseId);
  const urlLms = useSelector((state) => {
    if (!unitId) {
      return {};
    }

    const activeUnit = state.models.units[props.unitId];
    return activeUnit ? activeUnit.lmsWebUrl : undefined;
  });
  const urlStudio = getStudioUrl(courseId, unitId);
  const [masqueradeErrorMessage, showMasqueradeError] = useState(null);
  return (
    <div>
      <div className="bg-primary text-white">
        <div className="container-fluid py-3 d-md-flex justify-content-end align-items-start">
          <div className="align-items-center flex-grow-1 d-md-flex mx-1 my-1">
            <MasqueradeWidget courseId={courseId} onError={showMasqueradeError} />
          </div>
          {(urlLms || urlStudio || urlInsights) && (
            <>
              <hr className="border-light" />
              <span className="mr-2 mt-1 col-form-label">View course in:</span>
            </>
          )}
          {urlLms && (
            <span className="mx-1 my-1">
              <a className="btn btn-outline-light" href={urlLms}>Existing experience</a>
            </span>
          )}
          {urlStudio && (
            <span className="mx-1 my-1">
              <a className="btn btn-outline-light" href={urlStudio}>Studio</a>
            </span>
          )}
          {urlInsights && (
            <span className="mx-1 my-1">
              <a className="btn btn-outline-light" href={urlInsights}>Insights</a>
            </span>
          )}
        </div>
      </div>
      {masqueradeErrorMessage && (
        <div className="container-fluid mt-3">
          <Alert
            type={ALERT_TYPES.ERROR}
            dismissible={false}
          >
            {masqueradeErrorMessage}
          </Alert>
        </div>
      )}
    </div>
  );
}

InstructorToolbar.propTypes = {
  courseId: PropTypes.string,
  unitId: PropTypes.string,
};

InstructorToolbar.defaultProps = {
  courseId: undefined,
  unitId: undefined,
};

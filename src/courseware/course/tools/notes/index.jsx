import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { getConfig } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import {
  injectIntl, intlShape,
} from '@edx/frontend-platform/i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt } from '@fortawesome/free-solid-svg-icons';
import toggleNotes from '../data/thunks';
import messages from './messages';
import './notes.scss';


class NotesVisibility extends Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: props.course.notes.visible,
    };
    this.visibilityUrl = `${getConfig().LMS_BASE_URL}/courses/${props.course.id}/edxnotes/visibility/`;
  }

  handleClick = () => {
    const data = { visibility: this.state.visible };
    getAuthenticatedHttpClient().put(
      this.visibilityUrl,
      data,
    ).then(() => {
      this.setState((state) => ({ visible: !state.visible }));
      toggleNotes();
    });
  }

  render() {
    const message = this.state.visible ? 'notes.button.hide' : 'notes.button.show';
    return (
      <div className="notes-toggle">
        <div
          role="switch"
          className={`btn ${this.state.visible ? 'text-secondary' : 'text-success'}`}
          onClick={this.handleClick}
          onKeyDown={this.handleClick}
          tabIndex="-1"
          aria-checked={this.state.visible ? 'true' : 'false'}
        >
          <FontAwesomeIcon icon={faPencilAlt} aria-hidden="true" className="mr-2" />
          {this.props.intl.formatMessage(messages[message])}
        </div>
      </div>
    );
  }
}

NotesVisibility.propTypes = {
  intl: intlShape.isRequired,
  course: PropTypes.shape({
    id: PropTypes.string,
    notes: PropTypes.shape({
      enabled: PropTypes.bool,
      visible: PropTypes.bool,
    }),
  }).isRequired,
};

export default injectIntl(NotesVisibility);

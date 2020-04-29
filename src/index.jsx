import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {
  APP_INIT_ERROR, APP_READY, subscribe, initialize,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage } from '@edx/frontend-platform/react';
import React from 'react';
import ReactDOM from 'react-dom';
import { Route, Switch } from 'react-router-dom';

import { messages as headerMessages } from '@edx/frontend-component-header';
import Footer, { messages as footerMessages } from '@edx/frontend-component-footer';

import appMessages from './i18n';
import { UserMessagesProvider } from './user-messages';

import './index.scss';
import './assets/favicon.ico';
import CoursewareContainer from './courseware';
import CourseHomeContainer from './course-home';
import CoursewareRedirect from './CoursewareRedirect';

import store from './store';

subscribe(APP_READY, () => {
  ReactDOM.render(
    <AppProvider store={store}>
      <UserMessagesProvider>
        <Switch>
          <Route path="/redirect" component={CoursewareRedirect} />
          <Route path="/course/:courseId/home" component={CourseHomeContainer} />
          <Route
            path={[
              '/course/:courseId/:sequenceId/:unitId',
              '/course/:courseId/:sequenceId',
              '/course/:courseId',
            ]}
            component={CoursewareContainer}
          />
        </Switch>
        <Footer />
      </UserMessagesProvider>
    </AppProvider>,
    document.getElementById('root'),
  );
});

subscribe(APP_INIT_ERROR, (error) => {
  ReactDOM.render(<ErrorPage message={error.message} />, document.getElementById('root'));
});

initialize({
  // TODO: Remove this once the course blocks api supports unauthenticated
  // access and we are prepared to support public courses in this app.
  requireAuthenticatedUser: true,
  messages: [
    appMessages,
    headerMessages,
    footerMessages,
  ],
});

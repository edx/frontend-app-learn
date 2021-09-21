# Liberal courseware path handling

## Status

Accepted

_This updates some of the content in [ADR #2: Courseware page decisions](./0002-courseware-page-decisions.md)._

## Context

The courseware container currently accepts three path forms:

1. `/course/:courseId`
2. `/course/:courseId/:sequenceId`
3. `/course/:courseId/:sequenceId/:unitId`

Forms #1 and #2 are always redirected to Form #3 via simple set of rules:

* If the sequenceId is not specified, choose the first sequence in the course.
* If the unitId is not specified, choose the active unit in the sequence,
  or the first unit if none are active.

Thus, Form #3 is effectively the canonoical path;
all Learning MFE units should be served from it.
We acknowledge that the best user experience is to link directly to the canonoical
path when possible, since it skips the redirection steps.
Still, there are times when it is necessary or prudent to link just to a course or
a sequence.

Through recent work in the LMS, we are realizing that there are _also_ times where it
would be simpler or more performant to link a user to an
_entire section without specifying a squence_ or to a
_unit without including the sequence_.
Specifically, this capability would let as avoid further modulestore or
block transformer queries in order to discern the course structure when trying to
direct a learner to a section or unit.
Futhermore, we hypothesize that being able to build a Learning MFE courseware link
with just a unit ID or a section ID will be a nice simplifying quality for future
development or debugging.

## Decision

The courseware container will accept five total path forms:

1. `/course/:courseId`
2. `/course/:courseId/:sectionId`
3. `/course/:courseId/:sectionId/:unitId`
4. `/course/:courseId/:sequenceId`
5. `/course/:courseId/:unitId`
6. `/course/:courseId/:sequenceId/:unitId`

The redirection rules are as follows:

* Forms #1 redirects to Form #4 by selecting the first sequence in the course.
* Form #2 redirects to Form #4 by selecting to the first sequence in the section.
* Form #3 redirects to Form #5 by dropping the section ID.
* Form #4 redirects to Form #6 by choosing the active unit in the sequence
  (or the first unit, if none are active).
* Form #5 redirects to Form #6 by filling in the ID of the sequence that the
  specified unit belongs to (in the edge case where the unit belongs to multiple
  sequences, the first sequence is selected).

As before, Form #5 is the canonocial courseware path, which is always redirected to
by any of the other courseware path forms.

## Consequences

The above decision is implemented.

## Further work

At some point, we may decide to further extend the URL scheme to be
more human-readable.

We can't make UsageKeys themselves more readable because they're tied to student state,
but we could introduce a new optional `slug` field on Sequences,
which would be captured and propagated to the learning_sequences API.
We could eventually do something similar to Units, since those slugs only have to be sequence-local.

So eventually, URLs could look less like:

```

https://learning.edx.org/course/course-v1:edX+DemoX.1+2T2019/block-v1:edX+DemoX.1+2T2019+type@sequential+block@e0a61b3d5a2046949e76d12cac5df493/block-v1:edX+DemoX.1+2T2019+type@vertical+block@52dbad5a28e140f291a476f92ce11996
```

And more like:
```
https://learning.edx.org/course/course-v1:edX+DemoX.1+2T2019/Being_Social/Teams
```

_This further work has been expanded upon in
[ADR #9: Courseware URL shortening](./0009-courseware-url-shortening.md)._

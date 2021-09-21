# Courseware URL shortening

## Status

Accepted

_This updates some of the content in [ADR #8: Liberal courseware path handling](./0008-liberal-courseware-path-handling.md)._

## Context

The current URL is not human-readable. The URL is composed of the UsageKeys for the current sequence and unit. We can't make UsageKeys themselves more readable because they're tied to student state.

This is what the URLs currently look like:

```

https://learning.edx.org/course/course-v1:edX+DemoX.1+2T2019/block-v1:edX+DemoX.1+2T2019+type@sequential+block@e0a61b3d5a2046949e76d12cac5df493/block-v1:edX+DemoX.1+2T2019+type@vertical+block@52dbad5a28e140f291a476f92ce11996

```

After exploring different URL patterns and possible redundancies in the current URL format, the following key points were noticed. The course, run, and organization are stated in every portion of the URL. We also do not need the URL to tell us the type of block since it has been determined that all URLs will follow the path` /course/:courseId/:sequenceId/:unitId`.

## Decision

The courseware URL will format to the following structure:

```

https://learning.edx.org/c/:courseId/:sequenceHash/:unitHash/:sectionSlug/:sequenceSlug/:unitSlug/

```

Example URL:

```

https://learning.edx.org/c/course-v1:edX+DemoX.1+2T2019/YmxvY2/njuRCq/optional-example-problem-types/stem-problems/code-grader

```

The fields definition and requirements ar as follows:

* :courseId (required) - same as the previous `courseId`.
* :sequenceHash (required) - a `blake2b` version of the `sequenceId`'s `urlsafe_b64encode` .
* :unitHash (required) - a `blake2b` version of the `unitId`'s `urlsafe_b64encode`.
* :sectionSlug (optional) - `display_name` of the current sequence's parent section.
* :sequenceSlug (optional) - `display_name` of the current sequence.
* :unitSlug (optional) - `display_name` of the current unit

Partial paths will update with the required parameters as dicussed in [ADR #8: Liberal courseware path handling](./0008-liberal-courseware-path-handling.md). The `sequenceHash` and `unitHash` will shorten their respective ids using `hashlib.blake2b` with `digest_size` of 6 bytes. `Blake2b` will reduce the length of the id so the encoded version can also be short. Hashing will be handled by `blake2b` because it is the fastest hashing function in the `hashlib` library. The hash will be generated and mapped in LMS. The slugs based on `display_name` are optional because not all blocks have an associated `display_name` attributes, most likely to occur in OLX imports. The `display_name` will be pulled from the current section, sequence, and unit attribute, and if there is not an attribute `display`, the url will use the attribute `display_name_with_default`. The `display_name` will be formatted safely for a url using Django's [slugify](https://docs.djangoproject.com/en/3.2/ref/utils/#django.utils.text.slugify). Slugify allows unicode identifiers in the slug. If the slugs are omitted, it will redirect to the canonical version without the slugs.

## Consequences

If old URLs are not properly routed then the content and those links will no longer be accessible to the user. The old URLs could include, but not limited to, bookmarks and exams.

## Further work

At some point, we may decide to further extend the URL shortening to the entire platform. At the moment, the hashes for the sequences and units are generated when the sequences and units are being called. In the future, it would be better if the hashes would be generated and stored when the sequences and units are originally created. This would require `learning_sequences` to include a class for unit storage, which is not being stored at the moment.

/**
 * Adaptive Card for proactive tone-warning notifications.
 *
 * Sent to a message author when their message scores AGGRESSIVE in
 * tone analysis.  Delivered as a proactive 1:1 bot message.
 *
 * Action.Submit verbs:
 *  rephraseSuggestion  — user wants AI-suggested rephrasings
 *  dismiss             — user dismisses the warning
 */

export function buildToneWarningCard(originalText: string): object {
  const displayText =
    originalText.length > 300 ? originalText.slice(0, 300) + '…' : originalText;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [
                  { type: 'TextBlock', text: '⚠️', size: 'ExtraLarge' },
                ],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    text: 'Tone Alert — Spann',
                    weight: 'Bolder',
                    size: 'Medium',
                  },
                  {
                    type: 'TextBlock',
                    text: 'Your recent message was classified as **aggressive** by Spann\'s accessibility analysis.',
                    wrap: true,
                    spacing: 'None',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        text: 'Team members with anxiety or autism-spectrum profiles may find this tone difficult to process. Would you like some rephrasing suggestions?',
        wrap: true,
        spacing: 'Medium',
        isSubtle: true,
      },
      {
        type: 'Container',
        style: 'emphasis',
        spacing: 'Medium',
        items: [
          {
            type: 'TextBlock',
            text: 'Your message:',
            weight: 'Bolder',
            size: 'Small',
            spacing: 'None',
          },
          {
            type: 'TextBlock',
            text: displayText,
            wrap: true,
            isSubtle: true,
            spacing: 'Small',
            size: 'Small',
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: '✏️ Get rephrasing suggestions',
        style: 'positive',
        data: {
          verb: 'rephraseSuggestion',
          originalText,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Dismiss',
        data: { verb: 'dismiss' },
      },
    ],
  };
}

export interface FollowFeedback {
  title: string;
  message: string;
}

export function followFeedback(displayName: string, followed: boolean): FollowFeedback {
  return followed
    ? {
        title: 'Profilo seguito',
        message: `${displayName} apparira nella tua community personale.`,
      }
    : {
        title: 'Profilo rimosso',
        message: `${displayName} non è più tra i profili seguiti.`,
      };
}

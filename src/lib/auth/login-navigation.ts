export function getPostLoginDestination(inviteToken: string | null): string {
  return inviteToken
    ? `/join/${encodeURIComponent(inviteToken)}`
    : '/dashboard';
}

type FullPageNavigation = Pick<Location, 'assign'>;

export function navigateAfterLogin(
  destination: string,
  navigation: FullPageNavigation = window.location
): void {
  navigation.assign(destination);
}

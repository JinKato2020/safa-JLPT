import type { NavigationState } from '@react-navigation/native';

// A root detail screen also blurs a tab. Preserve its cards/history unless
// the selected tab actually changed. key can identify the tab or its stack.
export function didSwitchTab(state: Pick<NavigationState, 'index' | 'routes'>, key: string): boolean {
  const index = state.routes.findIndex(route => route.key === key || route.state?.key === key);
  return index >= 0 && state.index !== index;
}

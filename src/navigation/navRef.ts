// ナビゲーション参照(NavigationContainer外のオーバーレイから遷移するため)。
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

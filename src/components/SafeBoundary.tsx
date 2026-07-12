// JSレンダリング例外の防波堤。子がレンダーで例外を投げても、アプリ全体を白画面クラッシュさせず fallback を出す。
// 例外は匿名テレメトリへ通報(任意)。native モジュールのクラッシュは捕捉できない点に注意。
import React from 'react';
import { sendError } from '../telemetry/telemetry';

type Props = { children: React.ReactNode; fallback?: React.ReactNode; tag?: string };
type State = { err: boolean };

export default class SafeBoundary extends React.Component<Props, State> {
  state: State = { err: false };
  static getDerivedStateFromError(): State { return { err: true }; }
  componentDidCatch(e: unknown) {
    try { void sendError(`boundary:${this.props.tag ?? '?'}:${(e as { message?: string })?.message ?? String(e)}`, false); } catch { /* noop */ }
  }
  render() {
    return this.state.err ? (this.props.fallback ?? null) : this.props.children;
  }
}

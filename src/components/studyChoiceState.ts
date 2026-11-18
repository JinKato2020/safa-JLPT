export type StudyChoiceState = 'idle' | 'selected' | 'correct' | 'wrong';

/** 選択中と採点済みを分ける。模試・セット問題の選び直し中に正解を漏らさない。 */
export function studyChoiceState(index: number, selected: number | null, answer: number | undefined, revealed: boolean): StudyChoiceState {
  if (revealed && answer !== undefined) {
    if (index === answer) return 'correct';
    if (index === selected) return 'wrong';
    return 'idle';
  }
  return index === selected ? 'selected' : 'idle';
}

import { StyleSheet, Text } from 'react-native';
import { rubyNeeded } from '../data';
import type { Level } from '../engine/engine';
import type { ExamProblem } from '../ladder/examMix';
import RubyText from './RubyText';
import StudyChoiceList from './StudyChoiceList';
import { useStudyColors } from './StudyPresentation';
import StudyPrompt, { StudyInstruction } from './StudyPrompt';

export default function MixedExamQuestion({ problem, level, selected, onSelect }: {
  problem: ExamProblem; level: Level;
  selected: number | null; onSelect: (index: number) => void;
}) {
  const c = useStudyColors();
  const { question: q } = problem;
  const revealed = selected !== null;
  const rubyGate = (run: string) => rubyNeeded(run, level);
  const sentence = [styles.sentence, { color: c.ink }];
  return <>
    {q.question && <StudyInstruction>{q.question}</StudyInstruction>}
    <StudyPrompt>
      {q.furi ? (
        <RubyText text={q.furi} target={q.furiTarget} style={sentence} hitStyle={styles.underline}
          rubyGate={rubyGate} noRubyOnHit={q.noTargetRuby} />
      ) : (
        <>
          {q.prompt && <RubyText text={q.prompt} style={sentence} rubyGate={rubyGate} />}
          {q.example && <Text style={sentence}>{q.example.map((part, i) => (
            <Text key={i} style={part.hit ? styles.underline : undefined}>{part.text}</Text>
          ))}</Text>}
        </>
      )}
    </StudyPrompt>
    <StudyChoiceList choices={q.choices} selectedIndex={selected} answerIndex={q.answerIndex}
      revealed={revealed} onSelect={onSelect}
      renderChoice={(choice, _index, textStyle) => <RubyText text={choice} style={textStyle} rubyGate={rubyGate} />} />
    {revealed && (q.orderSentence || q.explain) ? (
      <StudyPrompt><RubyText text={q.orderSentence ?? q.explain!} style={sentence} rubyGate={rubyGate} /></StudyPrompt>
    ) : null}
  </>;
}

const styles = StyleSheet.create({
  sentence: { fontSize: 17, lineHeight: 27 },
  underline: { textDecorationLine: 'underline', fontWeight: '800' },
});

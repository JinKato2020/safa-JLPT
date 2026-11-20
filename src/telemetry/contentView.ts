type ContentRoute = { name: string; params?: object };

function option(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

export function contentView(route: ContentRoute): { content: string; level?: string } | undefined {
  const params = (route.params ?? {}) as Record<string, unknown>;
  const content = (key: string) => ({ content: key });
  const practice = (key: string) => ({
    content: key, level: option(params.level, ['N3', 'N4', 'N5'], '') || undefined,
  });
  const category = (value: unknown) => option(value, ['kanji', 'vocab', 'grammar'], 'all');

  switch (route.name) {
    case 'Quiz':
      if (params.review === true) return content('Quiz:review');
      return content('Quiz:' + option(params.daimon, [
        'kanji_read', 'orthography', 'context', 'synonym', 'usage', 'grammar_form', 'order', 'passage_grammar',
      ], 'general'));
    case 'Reading':
      return content('Reading:' + option(params.subtype, ['naiyou_tan', 'naiyou_chu', 'choubun', 'joho'], 'all'));
    case 'Listening':
      return content('Listening:' + option(params.subtype, ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji'], 'all'));
    case 'Kakitori':
      return practice('Kakitori:' + option(params.script, ['hiragana', 'katakana'], 'kanji'));
    case 'WordDrill':
      if (params.kind === 'weaknessMix') return practice('Quiz:review');
      return practice('WordDrill:' + option(params.kind, [
        'vProduce', 'gBuild', 'gMeaning', 'vMeaning', 'vReading', 'vWriting', 'mixed', 'practiceMix', 'examMix',
      ], 'all'));
    case 'ListeningQuiz':
      return content('ListeningQuiz:' + option(params.kind, ['vocab', 'kanji'], 'all'));
    case 'KanjiRecognition':
      return content('KanjiRecognition:' + option(params.mode, ['mean', 'read'], 'all'));
    case 'WordList':
    case 'DictList':
      return content(route.name + ':' + category(params.view));
    case 'Mock':
      return params.preview ? undefined : content(params.full === true ? 'Mock:full' : 'Mock:mini');
    case 'MyWords':
    case 'GrammarNote':
    case 'GrammarLessons':
    case 'KanjiDetail':
    case 'PosterList':
    case 'PosterAudio':
    case 'KanjiForm':
    case 'RadicalLessons':
    case 'PassageGrammar':
    case 'AICoach':
      return content(route.name);
    default:
      return undefined;
  }
}

-- 既存の screen_view を学習メニュー単位にまとめ、ユーザーの重複を除いてから集計する。
create or replace view public.v_admin_learning_content_matrix with (security_invoker = true) as
with raw as (
  select anon_id, account_id, level,
    coalesce(nullif(props->>'content', ''), props->>'name') as content
  from public.tel_event
  where name = 'screen_view'
    and created_at >= now() - interval '30 days'
    and level in ('N3', 'N4', 'N5')
), menu_map(raw_content, content) as (
  values
    ('Quiz:kanji_read', 'exam_reading'), ('KanjiRecognition:read', 'kanji_reading'),
    ('KanjiRecognition:mean', 'kanji_meaning'), ('KanjiForm', 'kanji_form'),
    ('Kakitori:kanji', 'kanji_writing'), ('ListeningQuiz:kanji', 'kanji_listening'),
    ('WordDrill:vReading', 'vocab_reading'),
    ('Quiz:orthography', 'exam_writing'), ('WordDrill:vWriting', 'vocab_writing'),
    ('WordDrill:vMeaning', 'vocab_meaning'), ('WordDrill:vProduce', 'vocab_produce'),
    ('ListeningQuiz:vocab', 'vocab_listening'),
    ('Quiz:context', 'vocab_context'), ('Quiz:synonym', 'vocab_synonym'), ('Quiz:usage', 'vocab_usage'),
    ('Quiz:grammar_form', 'grammar_form'), ('Quiz:order', 'grammar_order'),
    ('Quiz:passage_grammar', 'grammar_passage'), ('PassageGrammar', 'grammar_passage'),
    ('WordDrill:gBuild', 'grammar_build'), ('WordDrill:gMeaning', 'grammar_meaning'),
    ('Reading:naiyou_tan', 'reading_short'), ('Reading:naiyou_chu', 'reading_medium'),
    ('Reading:choubun', 'reading_long'), ('Reading:joho', 'reading_info'),
    ('Listening:kadai', 'listening_task'), ('Listening:point', 'listening_point'),
    ('Listening:gaiyou', 'listening_outline'), ('Listening:hatsuwa', 'listening_expression'),
    ('Listening:sokuji', 'listening_response'),
    ('PosterAudio', 'poster'), ('Flashcard', 'flashcard'), ('Flashcard:myWords', 'flashcard'),
    ('Quiz:review', 'review'), ('Quiz:expression', 'expression'),
    ('Mock:full', 'mock'), ('Mock:mini', 'mock'),
    ('AICoach', 'ai_coach'), ('MyWords', 'my_words'),
    ('DictList:kanji', 'dictionary_kanji'), ('DictList:vocab', 'dictionary_vocab'),
    ('DictList:grammar', 'dictionary_grammar'), ('DictList:all', 'dictionary_general'),
    ('KotobaTown', 'town'), ('Shop', 'shop'), ('Account', 'account'), ('Settings', 'settings'),
    ('KanjiDetail', 'kanji_detail'), ('GrammarNote', 'grammar_note'),
    ('WordList:kanji', 'kanji_list'), ('WordList:vocab', 'vocab_list'),
    ('WordList:grammar', 'grammar_list'), ('WordList:all', 'study_list'),
    ('Quiz:firstLesson', 'first_lesson'), ('Quiz:general', 'general_quiz'),
    ('Reading:all', 'reading_general'), ('Listening:all', 'listening_general'),
    ('WordDrill:mixed', 'general_drill'), ('WordDrill:all', 'general_drill'),
    ('ListeningQuiz:all', 'listening_drill'), ('KanjiRecognition:all', 'kanji_recognition')
), classified as (
  select r.anon_id, r.account_id, r.level,
    case when r.content like 'RadicalLesson:%' then 'radicals' else m.content end as content
  from raw r
  left join menu_map m on m.raw_content = r.content
), recent as (
  select * from classified where content is not null
), devices as (
  select distinct anon_id from recent
), accounts as (
  select distinct on (s.anon_id) s.anon_id, s.account_id
  from devices d
  join public.tel_snapshot s on s.anon_id = d.anon_id and s.account_id is not null
  order by s.anon_id, s.created_at desc
)
select r.content, r.level, count(*) as opens,
  count(distinct coalesce(r.account_id::text, a.account_id::text, r.anon_id)) as users
from recent r
left join accounts a using (anon_id)
group by r.content, r.level;

revoke all on public.v_admin_learning_content_matrix from public, anon, authenticated;
grant select on public.v_admin_learning_content_matrix to service_role;

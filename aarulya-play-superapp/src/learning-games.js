const rawGames = [
  {
    id: 'quiz-junior',
    name: 'Aarulya Quiz Junior',
    icon: '🧠',
    category: 'General Knowledge',
    age: '7+',
    description: 'भारत, विज्ञान, भाषा और दैनिक जीवन के छोटे प्रश्न।',
    questions: [
      ['भारत की राजधानी क्या है?', ['नई दिल्ली', 'मुंबई', 'पटना', 'जयपुर'], 0, 'नई दिल्ली भारत की राजधानी है।'],
      ['पानी का रासायनिक सूत्र क्या है?', ['CO₂', 'H₂O', 'O₂', 'NaCl'], 1, 'पानी दो हाइड्रोजन और एक ऑक्सीजन परमाणु से बनता है।'],
      ['सूर्य किस दिशा से उगता है?', ['उत्तर', 'दक्षिण', 'पूर्व', 'पश्चिम'], 2, 'सूर्य पूर्व दिशा से उगता दिखाई देता है।'],
      ['एक सप्ताह में कितने दिन होते हैं?', ['5', '6', '7', '8'], 2, 'एक सप्ताह में सात दिन होते हैं।'],
      ['पेड़ हमें मुख्य रूप से कौन-सी गैस देते हैं?', ['ऑक्सीजन', 'हाइड्रोजन', 'हीलियम', 'नाइट्रोजन'], 0, 'प्रकाश संश्लेषण के दौरान पौधे ऑक्सीजन छोड़ते हैं।'],
      ['राष्ट्रीय पशु कौन है?', ['हाथी', 'बाघ', 'मोर', 'शेर'], 1, 'रॉयल बंगाल टाइगर भारत का राष्ट्रीय पशु है।'],
      ['कंप्यूटर का दिमाग किसे कहा जाता है?', ['माउस', 'कीबोर्ड', 'CPU', 'स्क्रीन'], 2, 'CPU निर्देशों को संसाधित करता है।'],
      ['15 अगस्त को भारत में क्या मनाया जाता है?', ['गणतंत्र दिवस', 'स्वतंत्रता दिवस', 'बाल दिवस', 'शिक्षक दिवस'], 1, '15 अगस्त भारत का स्वतंत्रता दिवस है।']
    ]
  },
  {
    id: 'math-adventure',
    name: 'Aarulya Math Adventure',
    icon: '➗',
    category: 'Mathematics',
    age: '7+',
    description: 'जोड़, घटाव, गुणा, भाग और आसान तर्क अभ्यास।',
    questions: [
      ['18 + 27 = ?', ['35', '45', '55', '46'], 1, '18 और 27 का योग 45 है।'],
      ['9 × 7 = ?', ['56', '63', '72', '49'], 1, '9 गुणा 7 बराबर 63।'],
      ['84 ÷ 7 = ?', ['10', '11', '12', '14'], 2, '84 को 7 से भाग देने पर 12 मिलता है।'],
      ['100 - 46 = ?', ['44', '54', '64', '56'], 1, '100 में से 46 घटाने पर 54।'],
      ['3, 6, 9, 12 के बाद क्या आएगा?', ['14', '15', '16', '18'], 1, 'हर बार 3 जोड़ा जा रहा है, इसलिए अगला 15 है।'],
      ['एक दर्जन में कितनी वस्तुएँ होती हैं?', ['10', '12', '20', '24'], 1, 'एक दर्जन का अर्थ 12 होता है।'],
      ['₹50 में से ₹18 खर्च हुए। कितने बचे?', ['₹22', '₹28', '₹32', '₹38'], 2, '50 - 18 = 32।'],
      ['5² = ?', ['10', '20', '25', '30'], 2, '5 का वर्ग 5 × 5 = 25 है।']
    ]
  },
  {
    id: 'word-builder',
    name: 'Aarulya Word Builder',
    icon: '🔤',
    category: 'Language',
    age: '7+',
    description: 'हिंदी और English शब्द, विलोम तथा सही spelling।',
    questions: [
      ['“दिन” का विलोम क्या है?', ['सुबह', 'रात', 'धूप', 'शाम'], 1, 'दिन का विलोम रात है।'],
      ['सही English spelling चुनें:', ['BEAUTIFULL', 'BEUTIFUL', 'BEAUTIFUL', 'BEAUTIFEL'], 2, 'सही spelling BEAUTIFUL है।'],
      ['“जल” का समानार्थी शब्द क्या है?', ['अग्नि', 'वायु', 'पानी', 'धरती'], 2, 'जल का समानार्थी पानी है।'],
      ['CAT का हिंदी अर्थ क्या है?', ['कुत्ता', 'बिल्ली', 'घोड़ा', 'पक्षी'], 1, 'CAT का अर्थ बिल्ली है।'],
      ['“ईमानदार” का विलोम क्या है?', ['सच्चा', 'बेईमान', 'दयालु', 'बहादुर'], 1, 'ईमानदार का विलोम बेईमान है।'],
      ['रिक्त स्थान भरें: I ___ a student.', ['am', 'is', 'are', 'be'], 0, 'I के साथ am आता है।'],
      ['“पुस्तक” का English अर्थ क्या है?', ['Pen', 'Book', 'Bag', 'Desk'], 1, 'पुस्तक का अर्थ Book है।'],
      ['सही बहुवचन चुनें: Child → ?', ['Childs', 'Children', 'Childes', 'Childrens'], 1, 'Child का सही plural Children है।']
    ]
  },
  {
    id: 'robot-lab',
    name: 'Aarulya Robot Lab',
    icon: '🤖',
    category: 'Logic & Coding',
    age: '8+',
    description: 'क्रम, दिशा, condition और coding logic के शुरुआती प्रश्न।',
    questions: [
      ['Robot उत्तर की ओर है। Right turn के बाद किस दिशा में होगा?', ['पश्चिम', 'पूर्व', 'दक्षिण', 'उत्तर'], 1, 'उत्तर से दायाँ मोड़ पूर्व की ओर होता है।'],
      ['Repeat 3 times: clap. कुल कितनी clap?', ['1', '2', '3', '4'], 2, 'Repeat 3 times का मतलब तीन बार है।'],
      ['IF rain THEN umbrella. Rain हो रही है, क्या लेना चाहिए?', ['टोपी', 'छाता', 'जूता', 'किताब'], 1, 'Condition true होने पर umbrella वाला action चलेगा।'],
      ['Sequence: Start → Move → Stop. बीच का step कौन है?', ['Start', 'Move', 'Stop', 'End'], 1, 'Move बीच वाला step है।'],
      ['0 और 1 पर आधारित number system क्या कहलाता है?', ['Decimal', 'Binary', 'Roman', 'Fraction'], 1, 'Binary system में 0 और 1 होते हैं।'],
      ['Bug का अर्थ coding में क्या है?', ['Robot', 'Error', 'Button', 'Battery'], 1, 'Bug program की गलती या defect है।'],
      ['चार कदम आगे और दो कदम पीछे: net कितने कदम आगे?', ['2', '4', '6', '8'], 0, '4 - 2 = 2 कदम आगे।'],
      ['एक साफ निर्देशों की सूची को क्या कहते हैं?', ['Algorithm', 'Picture', 'Password', 'Folder'], 0, 'Algorithm किसी काम के क्रमबद्ध steps हैं।']
    ]
  },
  {
    id: 'school-adventure',
    name: 'Aarulya School Adventure',
    icon: '🏫',
    category: 'School Skills',
    age: '7+',
    description: 'सुरक्षा, आदत, जिम्मेदारी और classroom decisions।',
    questions: [
      ['कक्षा में प्रश्न समझ न आए तो क्या करना चाहिए?', ['चुप रहना', 'शिक्षक से पूछना', 'कॉपी फाड़ना', 'घर चले जाना'], 1, 'सम्मानपूर्वक प्रश्न पूछना सही सीखने की आदत है।'],
      ['अनजान व्यक्ति online निजी पता माँगे तो क्या करें?', ['तुरंत भेजें', 'मना करें और trusted adult को बताएँ', 'सबको पोस्ट करें', 'मजाक करें'], 1, 'निजी जानकारी साझा नहीं करनी चाहिए।'],
      ['स्कूल की सीढ़ियों पर सुरक्षित तरीका क्या है?', ['दौड़ना', 'धक्का देना', 'रेलिंग पकड़कर चलना', 'कूदना'], 2, 'सीढ़ियों पर धीरे चलना और रेलिंग पकड़ना सुरक्षित है।'],
      ['किसी साथी की वस्तु लेने से पहले क्या करें?', ['छिपाकर लें', 'अनुमति माँगें', 'तोड़ दें', 'किसी और को दें'], 1, 'दूसरे की वस्तु लेने से पहले अनुमति जरूरी है।'],
      ['होमवर्क समय पर करने की अच्छी विधि क्या है?', ['अंतिम मिनट तक रोकना', 'छोटा schedule बनाना', 'नकल करना', 'छोड़ देना'], 1, 'छोटा नियमित schedule काम पूरा करने में मदद करता है।'],
      ['Bullying दिखे तो सबसे सुरक्षित कदम क्या है?', ['हँसना', 'वीडियो बनाना', 'trusted teacher/adult को बताना', 'अकेले लड़ना'], 2, 'विश्वसनीय वयस्क को बताना सुरक्षित और जिम्मेदार कदम है।'],
      ['Library book का ध्यान कैसे रखें?', ['पन्ना फाड़ें', 'सूखा और साफ रखें', 'उस पर खाना रखें', 'गुम कर दें'], 1, 'साझा पुस्तक को साफ और सुरक्षित रखना चाहिए।'],
      ['समूह कार्य में सही व्यवहार क्या है?', ['सबको सुनना', 'केवल खुद बोलना', 'मजाक उड़ाना', 'काम छोड़ना'], 0, 'अच्छे teamwork में सभी को सुनना जरूरी है।']
    ]
  }
];

function freezeQuestion([prompt, options, answerIndex, explanation]) {
  return Object.freeze({ prompt, options: Object.freeze([...options]), answerIndex, explanation });
}

export const LEARNING_GAMES = Object.freeze(rawGames.map((game) => Object.freeze({
  ...game,
  localOnly: true,
  rewardType: 'virtual',
  questions: Object.freeze(game.questions.map(freezeQuestion))
})));

export function getLearningGame(gameId) {
  return LEARNING_GAMES.find((game) => game.id === gameId) ?? null;
}

export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createLearningRound(gameId, count = 5, rng = Math.random) {
  const game = getLearningGame(gameId);
  if (!game) throw new Error(`Unknown learning game: ${gameId}`);
  const safeCount = Math.max(1, Math.min(Number(count) || 5, game.questions.length));
  return Object.freeze(shuffle(game.questions, rng).slice(0, safeCount));
}

export function gradeAnswer(question, selectedIndex) {
  if (!question || !Array.isArray(question.options)) throw new TypeError('A valid question is required.');
  const selected = Number(selectedIndex);
  const correct = Number.isInteger(selected) && selected === question.answerIndex;
  return Object.freeze({
    correct,
    points: correct ? 20 : 0,
    correctIndex: question.answerIndex,
    explanation: question.explanation
  });
}

/**
 * AI Engine - Pure JavaScript NLP for complaint analysis
 * No external API required - runs entirely on the server
 */

// Category keyword definitions with weights
const CATEGORIES = {
    Academics: {
        keywords: ['course', 'curriculum', 'syllabus', 'lecture', 'class', 'attendance', 'study', 'grade', 'marks', 'professor', 'teacher', 'assignment', 'project', 'semester', 'notes', 'timetable', 'schedule', 'lab', 'practical', 'textbook', 'library', 'research', 'thesis', 'internship', 'cgpa', 'gpa', 'subject'],
        weights: { course: 2, curriculum: 2, syllabus: 2, grade: 1.5, marks: 1.5, attendance: 2, assignment: 1.5, semester: 1.5, cgpa: 2, gpa: 2 }
    },
    Hostel: {
        keywords: ['hostel', 'dorm', 'dormitory', 'room', 'mess', 'food', 'warden', 'accommodation', 'bed', 'bathroom', 'toilet', 'water', 'electricity', 'cleanliness', 'hygiene', 'laundry', 'dining', 'canteen', 'block', 'floor', 'roommate', 'curfew', 'gate', 'inmate', 'facility', 'mattress', 'fan', 'ac', 'air conditioning'],
        weights: { hostel: 3, dorm: 2, dormitory: 2, mess: 2, warden: 2, accommodation: 2, water: 1, electricity: 1 }
    },
    Transport: {
        keywords: ['bus', 'transport', 'vehicle', 'route', 'driver', 'timing', 'schedule', 'pickup', 'drop', 'shuttle', 'commute', 'travel', 'stop', 'station', 'late', 'early', 'delay', 'fare', 'pass', 'auto', 'cab'],
        weights: { bus: 3, transport: 3, vehicle: 2, route: 2, driver: 2, shuttle: 2, commute: 2 }
    },
    Infrastructure: {
        keywords: ['building', 'classroom', 'wifi', 'internet', 'network', 'electricity', 'lift', 'elevator', 'toilet', 'parking', 'road', 'furniture', 'projector', 'computer', 'lab', 'equipment', 'repair', 'maintenance', 'ac', 'fan', 'light', 'water', 'pipe', 'leaking', 'broken', 'damaged', 'construction', 'drainage', 'garbage', 'cleanliness'],
        weights: { wifi: 2, internet: 2, building: 2, elevator: 2, projector: 2, maintenance: 2, infrastructure: 3 }
    },
    Faculty: {
        keywords: ['faculty', 'professor', 'teacher', 'lecturer', 'instructor', 'staff', 'absent', 'leave', 'class', 'teaching', 'behavior', 'attitude', 'bias', 'grading', 'favoritism', 'harassment', 'unprofessional', 'substitute', 'replacement', 'mentor', 'guide', 'hod', 'department head'],
        weights: { faculty: 3, professor: 2, teacher: 2, lecturer: 2, absent: 2, harassment: 3, favoritism: 2, bias: 2 }
    },
    Exams: {
        keywords: ['exam', 'examination', 'test', 'quiz', 'paper', 'question', 'answer', 'result', 'marksheet', 'revaluation', 'supplementary', 'backlog', 'timetable', 'hall ticket', 'admit card', 'invigilator', 'malpractice', 'cheating', 'clash', 'date', 'schedule', 'score'],
        weights: { exam: 3, examination: 3, revaluation: 2, supplementary: 2, backlog: 2, 'hall ticket': 2, 'admit card': 2, clash: 2 }
    },
    Others: {
        keywords: ['fee', 'payment', 'scholarship', 'certificate', 'document', 'bonafide', 'noc', 'sports', 'event', 'cultural', 'club', 'counseling', 'mental health', 'ragging', 'security', 'safety', 'emergency', 'medical', 'health', 'insurance'],
        weights: { fee: 2, scholarship: 2, ragging: 3, security: 2, medical: 2, health: 2 }
    }
};

// Priority keywords
const PRIORITY_KEYWORDS = {
    high: {
        words: ['urgent', 'immediately', 'emergency', 'critical', 'severe', 'serious', 'dangerous', 'hazardous', 'harassment', 'ragging', 'violence', 'threat', 'unsafe', 'crisis', 'cannot', "can't", 'impossible', 'severely', 'extremely', 'chronic', 'repeatedly', 'always', 'never', 'outrageous', 'unbearable'],
        weight: 3
    },
    medium: {
        words: ['problem', 'issue', 'concern', 'complaint', 'facing', 'difficulty', 'trouble', 'need', 'required', 'necessary', 'affecting', 'impact', 'inconvenience', 'frequently', 'often', 'regularly', 'weeks', 'days'],
        weight: 1
    },
    low: {
        words: ['minor', 'small', 'suggest', 'suggestion', 'improvement', 'better', 'nice', 'would be', 'could be', 'sometimes', 'occasionally', 'little'],
        weight: -2
    }
};

// Sentiment word lists
const SENTIMENT = {
    negative: {
        words: ['bad', 'terrible', 'horrible', 'awful', 'disgusting', 'unacceptable', 'pathetic', 'useless', 'broken', 'failed', 'failure', 'problem', 'issue', 'complaint', 'angry', 'frustrated', 'disappointed', 'sad', 'upset', 'worried', 'anxious', 'stressed', 'disturbed', 'uncomfortable', 'suffering', 'struggling', 'unbearable', 'intolerable', 'negligent', 'negligence', 'careless', 'irresponsible', 'poor', 'worst', 'missing', 'absent', 'denied', 'rejected', 'unfair', 'biased', 'unjust', 'violated', 'harassed'],
        weight: -1
    },
    positive: {
        words: ['good', 'great', 'excellent', 'wonderful', 'amazing', 'helpful', 'better', 'improved', 'resolved', 'solved', 'fixed', 'satisfied', 'happy', 'pleased', 'thankful', 'grateful', 'appreciate', 'impressed'],
        weight: 1
    },
    intensifiers: {
        words: ['very', 'extremely', 'severely', 'highly', 'absolutely', 'completely', 'utterly', 'totally', 'really', 'deeply'],
        weight: 0.5
    }
};

// Department mapping
const DEPT_MAP = {
    Academics: 'Academics Department',
    Hostel: 'Hostel Management',
    Transport: 'Transport Department',
    Infrastructure: 'Infrastructure & Maintenance',
    Faculty: 'Academics Department',
    Exams: 'Examination Cell',
    Others: 'Student Affairs Office'
};

/**
 * Tokenize text into lowercase words
 */
function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
}

/**
 * Check for key phrase in text
 */
function containsPhrase(text, phrase) {
    return text.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Classify complaint category
 */
function classifyCategory(title, description) {
    const fullText = `${title} ${description}`.toLowerCase();
    const tokens = tokenize(fullText);
    const scores = {};

    for (const [category, data] of Object.entries(CATEGORIES)) {
        let score = 0;
        for (const token of tokens) {
            if (data.keywords.includes(token)) {
                score += data.weights[token] || 1;
            }
        }
        // Check for multi-word phrases
        for (const [phrase, weight] of Object.entries(data.weights)) {
            if (phrase.includes(' ') && containsPhrase(fullText, phrase)) {
                score += weight;
            }
        }
        scores[category] = score;
    }

    // Find highest scoring category
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestCategory, bestScore] = sorted[0];
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(0.95, bestScore / totalScore + 0.3) : 0.5;

    return {
        category: bestScore > 0 ? bestCategory : 'Others',
        confidence: parseFloat(confidence.toFixed(2)),
        scores
    };
}

/**
 * Detect complaint priority
 */
function detectPriority(title, description) {
    const fullText = `${title} ${description}`.toLowerCase();
    const tokens = tokenize(fullText);
    let priorityScore = 0;

    for (const token of tokens) {
        if (PRIORITY_KEYWORDS.high.words.includes(token)) {
            priorityScore += PRIORITY_KEYWORDS.high.weight;
        } else if (PRIORITY_KEYWORDS.medium.words.includes(token)) {
            priorityScore += PRIORITY_KEYWORDS.medium.weight;
        } else if (PRIORITY_KEYWORDS.low.words.includes(token)) {
            priorityScore += PRIORITY_KEYWORDS.low.weight;
        }
    }

    // Additional heuristics
    if (fullText.includes('days') || fullText.includes('weeks')) priorityScore += 1;
    if (fullText.includes('3 days') || fullText.includes('week') || fullText.includes('long time')) priorityScore += 2;
    if (fullText.includes('!')) priorityScore += 1;
    if ((fullText.match(/!/g) || []).length > 2) priorityScore += 2;
    if (description.length > 300) priorityScore += 1;

    if (priorityScore >= 5) return 'High';
    if (priorityScore >= 2) return 'Medium';
    return 'Low';
}

/**
 * Perform sentiment analysis
 */
function analyzeSentiment(title, description) {
    const fullText = `${title} ${description}`.toLowerCase();
    const tokens = tokenize(fullText);
    let score = 0;
    let prevWasIntensifier = false;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const multiplier = prevWasIntensifier ? 1.5 : 1;

        if (SENTIMENT.negative.words.includes(token)) {
            score += SENTIMENT.negative.weight * multiplier;
            prevWasIntensifier = false;
        } else if (SENTIMENT.positive.words.includes(token)) {
            score += SENTIMENT.positive.weight * multiplier;
            prevWasIntensifier = false;
        } else if (SENTIMENT.intensifiers.words.includes(token)) {
            prevWasIntensifier = true;
        } else {
            prevWasIntensifier = false;
        }
    }

    // Normalize score
    const normalizedScore = Math.max(-1, Math.min(1, score / 5));

    let label, emoji, urgency;
    if (normalizedScore <= -0.6) {
        label = 'Very Negative'; emoji = '😡'; urgency = 'High Urgency';
    } else if (normalizedScore <= -0.2) {
        label = 'Negative'; emoji = '😞'; urgency = 'Medium Urgency';
    } else if (normalizedScore <= 0.2) {
        label = 'Neutral'; emoji = '😐'; urgency = 'Normal';
    } else if (normalizedScore <= 0.6) {
        label = 'Positive'; emoji = '🙂'; urgency = 'Low Urgency';
    } else {
        label = 'Very Positive'; emoji = '😊'; urgency = 'Minimal Urgency';
    }

    return {
        score: parseFloat(normalizedScore.toFixed(2)),
        label,
        emoji,
        urgency
    };
}

/**
 * Extract key tags from text
 */
function extractTags(title, description) {
    const fullText = `${title} ${description}`.toLowerCase();
    const tokens = tokenize(fullText);
    const allKeywords = Object.values(CATEGORIES).flatMap(c => c.keywords);
    const tags = [...new Set(tokens.filter(t => allKeywords.includes(t)))].slice(0, 5);
    return tags.join(',');
}

/**
 * Full AI analysis - combines all modules
 */
function analyzeComplaint(title, description) {
    const categoryResult = classifyCategory(title, description);
    const priority = detectPriority(title, description);
    const sentiment = analyzeSentiment(title, description);
    const tags = extractTags(title, description);
    const assignedDept = DEPT_MAP[categoryResult.category];

    return {
        category: categoryResult.category,
        confidence: categoryResult.confidence,
        priority,
        sentiment: {
            score: sentiment.score,
            label: sentiment.label,
            emoji: sentiment.emoji,
            urgency: sentiment.urgency
        },
        assignedDept,
        tags
    };
}

module.exports = { analyzeComplaint, classifyCategory, detectPriority, analyzeSentiment };

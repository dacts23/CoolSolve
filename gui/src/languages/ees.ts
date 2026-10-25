import type * as Monaco from 'monaco-editor';

export const EES_LANGUAGE_ID = 'coolsolve';

export function registerEESLanguage(monaco: typeof Monaco) {
  // Idempotent: React StrictMode double-mounts in dev.
  if (monaco.languages.getLanguages().some((l) => l.id === EES_LANGUAGE_ID)) return;
  // Register language
  monaco.languages.register({ id: EES_LANGUAGE_ID });

  // Token provider (Monarch)
  monaco.languages.setMonarchTokensProvider(EES_LANGUAGE_ID, {
    ignoreCase: true,
    keywords: [
      'FUNCTION', 'PROCEDURE', 'END', 'CALL',
      'IF', 'THEN', 'ELSE', 'ENDIF',
      'AND', 'OR', 'NOT',
      'REPEAT', 'UNTIL',
      'GOTO',
      'SUBPROGRAM', 'MODULE',
    ],
    typeKeywords: [
      'Water', 'R134a', 'R245fa', 'R22', 'R410A', 'R32',
      'CO2', 'Nitrogen', 'Oxygen', 'Air', 'Air_ha',
      'Ammonia', 'NH3H2O', 'Propane', 'Butane', 'Isobutane',
      'R1234yf', 'R1234ze', 'R407C', 'R404A', 'R507A',
    ],
    builtinFunctions: [
      'enthalpy', 'entropy', 'density', 'pressure', 'temperature',
      'quality', 'cp', 'cv', 'specheat', 'volume',
      'viscosity', 'conductivity', 'prandtl', 'surfacetension',
      'soundspeed', 'internalenergy', 'intenergy', 'massfraction', 'volexpcoef', 'isidealgas',
      'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
      'exp', 'ln', 'log', 'log10', 'sqrt', 'abs',
      'min', 'max', 'round', 'trunc', 'ceil', 'floor',
      'nDay_', 'NumDay_', 'AveDay_', 'EqnTime_',
      'X_LIBR', 'H_LIBR', 'T_LIBR', 'P_LIBR', 'NH3H2O',
      'DELTAh_s', 'T_sat', 'P_sat', 'h_sat', 's_sat',
      'convert', 'unitsystem', 'error', 'warning', 'colebrook',
      // String functions
      'uppercase$', 'lowercase$',
      // Lookup table functions
      'interpolate', 'interpolate1', 'interpolate2', 'interpolate2dm',
      'lookup', 'lookup$', 'lookup$row', 'lookupcol', 'lookupcol1', 'lookupcellempty',
      'tablevalue', 'nlookuprows', 'nlookupcolumns',
      'sumlookup', 'avglookup', 'maxlookup', 'minlookup', 'stddevlookup',
      // Equation-based integration (INTEGRAL / $IntegralTable)
      'integral', 'integralvalue',
    ],
    operators: [
      '=', ':=', '+', '-', '*', '/', '^',
      '<', '>', '<=', '>=', '=<', '=>', '<>', '==',
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,

    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, 'comment'],
        [/\{/, 'comment', '@bracketComment'],
        [/"/, 'string', '@quoteComment'],
        [/'/, 'string', '@singleQuoteString'],

        // Directives
        [/\$\w+/, 'keyword.directive'],

        // Numbers
        [/\d+\.?\d*([eE][+-]?\d+)?/, 'number'],
        [/\.\d+([eE][+-]?\d+)?/, 'number'],

        // Identifiers: letters (accented ones too), digits, _ and the symbols % | # \ ° of equation names,
        // with the $ that ends a string variable or a string function (LOOKUP$), and the $ inside LOOKUP$ROW
        [/[a-zA-Z_\u00C0-\u00FF][\w%|#\\\u00B0\u00B2\u00B3\u00B5\u00B9\u00C0-\u00FF]*(?:\$row(?=\s*\())?\$?/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type.identifier',
            '@builtinFunctions': 'predefined',
            '@default': 'identifier',
          },
        }],

        // Array subscripts
        [/\[/, 'delimiter.bracket', '@array'],

        // Operators
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        }],

        // Whitespace
        [/\s+/, 'white'],

        // Delimiters
        [/[(),:;]/, 'delimiter'],
      ],

      bracketComment: [
        [/[^}]+/, 'comment'],
        [/\}/, 'comment', '@pop'],
      ],

      quoteComment: [
        [/[^"]+/, 'string'],
        [/"/, 'string', '@pop'],
      ],

      singleQuoteString: [
        [/[^'\\]+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
        [/$/, 'string', '@pop'],
      ],

      array: [
        [/\]/, 'delimiter.bracket', '@pop'],
        [/\d+\.?\d*([eE][+-]?\d+)?/, 'number'],
        [/\.\./, 'operator'],
        [/[a-zA-Z_\u00C0-\u00FF][\w%|#\\\u00B0\u00B2\u00B3\u00B5\u00B9\u00C0-\u00FF]*/, 'identifier'],
        [/[+\-*/^.,:;()]/, 'operator'],
        [/\s+/, 'white'],
        [/[^\]\s]+/, 'type'],
        [/$/, '', '@pop'],
      ],
    },
  });

  // Language configuration
  monaco.languages.setLanguageConfiguration(EES_LANGUAGE_ID, {
    comments: {
      lineComment: '//',
      blockComment: ['{', '}'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*(FUNCTION|PROCEDURE|IF)\b/i,
        end: /^\s*(END|ENDIF)\b/i,
      },
    },
    indentationRules: {
      increaseIndentPattern: /^\s*(FUNCTION|PROCEDURE|IF|ELSE)\b/i,
      decreaseIndentPattern: /^\s*(END|ENDIF|ELSE)\b/i,
    },
  });
}

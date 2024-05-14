// Mostly all of this is lifted from `jsonc-parser` package
// See: https://github.com/microsoft/node-jsonc-parser/tree/b6b34ba39da3f5bee17d41004c03a86686dade4c

/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore always check the errors list to find out if the input was valid.
 */
export function parse(text, errors = [], options = {
  allowTrailingComma: false,
}) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];

  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }

  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    },
  };
  visit(text, visitor, options);
  return currentParent[0];
}

/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
export function visit(text, visitor, options = { allowTrailingComma: false }) {
  const _scanner = createScanner(text, false);
  // Important: Only pass copies of this to visitor functions to prevent accidental modification, and
  // to not affect visitor functions which stored a reference to a previous JSONPath
  const _jsonPath = [];

  function toNoArgVisit(visitFunction) {
    return visitFunction
      ? () =>
        visitFunction(
          _scanner.getTokenOffset(),
          _scanner.getTokenLength(),
          _scanner.getTokenStartLine(),
          _scanner.getTokenStartCharacter(),
        )
      : () => true;
  }
  function toNoArgVisitWithPath(visitFunction) {
    return visitFunction
      ? () =>
        visitFunction(
          _scanner.getTokenOffset(),
          _scanner.getTokenLength(),
          _scanner.getTokenStartLine(),
          _scanner.getTokenStartCharacter(),
          () => _jsonPath.slice(),
        )
      : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction
      ? (arg) =>
        visitFunction(
          arg,
          _scanner.getTokenOffset(),
          _scanner.getTokenLength(),
          _scanner.getTokenStartLine(),
          _scanner.getTokenStartCharacter(),
        )
      : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction
      ? (arg) =>
        visitFunction(
          arg,
          _scanner.getTokenOffset(),
          _scanner.getTokenLength(),
          _scanner.getTokenStartLine(),
          _scanner.getTokenStartCharacter(),
          () => _jsonPath.slice(),
        )
      : () => true;
  }

  const onObjectBegin = toNoArgVisitWithPath(visitor.onObjectBegin);
  const onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty);
  const onObjectEnd = toNoArgVisit(visitor.onObjectEnd);
  const onArrayBegin = toNoArgVisitWithPath(visitor.onArrayBegin);
  const onArrayEnd = toNoArgVisit(visitor.onArrayEnd);
  const onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue);
  const onSeparator = toOneArgVisit(visitor.onSeparator);
  const onComment = toNoArgVisit(visitor.onComment);
  const onError = toOneArgVisit(visitor.onError);

  const disallowComments = options?.disallowComments;
  const allowTrailingComma = options?.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case ScanError.InvalidUnicode:
          handleError(ParseErrorCode.InvalidUnicode);
          break;
        case ScanError.InvalidEscapeCharacter:
          handleError(ParseErrorCode.InvalidEscapeCharacter);
          break;
        case ScanError.UnexpectedEndOfNumber:
          handleError(ParseErrorCode.UnexpectedEndOfNumber);
          break;
        case ScanError.UnexpectedEndOfComment:
          if (!disallowComments) {
            handleError(ParseErrorCode.UnexpectedEndOfComment);
          }
          break;
        case ScanError.UnexpectedEndOfString:
          handleError(ParseErrorCode.UnexpectedEndOfString);
          break;
        case ScanError.InvalidCharacter:
          handleError(ParseErrorCode.InvalidCharacter);
          break;
      }
      switch (token) {
        case SyntaxKind.LineCommentTrivia:
        case SyntaxKind.BlockCommentTrivia:
          if (disallowComments) {
            handleError(ParseErrorCode.InvalidCommentToken);
          } else {
            onComment();
          }
          break;
        case SyntaxKind.Unknown:
          handleError(ParseErrorCode.InvalidSymbol);
          break;
        case SyntaxKind.Trivia:
        case SyntaxKind.LineBreakTrivia:
          break;
        default:
          return token;
      }
    }
  }

  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== SyntaxKind.EOF) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
          // biome-ignore lint/style/noUselessElse: don't feel confident that the recommended change is safe
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }

  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      // add property name afterwards
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }

  function parseLiteral() {
    switch (_scanner.getToken()) {
      case SyntaxKind.NumericLiteral: {
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);

        if (Number.isNaN(value)) {
          handleError(ParseErrorCode.InvalidNumberFormat);
          value = 0;
        }

        onLiteralValue(value);
        break;
      }
      case SyntaxKind.NullKeyword:
        onLiteralValue(null);
        break;
      case SyntaxKind.TrueKeyword:
        onLiteralValue(true);
        break;
      case SyntaxKind.FalseKeyword:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }

  function parseProperty() {
    if (_scanner.getToken() !== SyntaxKind.StringLiteral) {
      handleError(ParseErrorCode.PropertyNameExpected, [], [SyntaxKind.CloseBraceToken, SyntaxKind.CommaToken]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === SyntaxKind.ColonToken) {
      onSeparator(":");
      scanNext(); // consume colon

      if (!parseValue()) {
        handleError(ParseErrorCode.ValueExpected, [], [SyntaxKind.CloseBraceToken, SyntaxKind.CommaToken]);
      }
    } else {
      handleError(ParseErrorCode.ColonExpected, [], [SyntaxKind.CloseBraceToken, SyntaxKind.CommaToken]);
    }
    _jsonPath.pop(); // remove processed property name
    return true;
  }

  function parseObject() {
    onObjectBegin();
    scanNext(); // consume open brace

    let needsComma = false;
    while (_scanner.getToken() !== SyntaxKind.CloseBraceToken && _scanner.getToken() !== SyntaxKind.EOF) {
      if (_scanner.getToken() === SyntaxKind.CommaToken) {
        if (!needsComma) {
          handleError(ParseErrorCode.ValueExpected, [], []);
        }
        onSeparator(",");
        scanNext(); // consume comma
        if (_scanner.getToken() === SyntaxKind.CloseBraceToken && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(ParseErrorCode.CommaExpected, [], []);
      }
      if (!parseProperty()) {
        handleError(ParseErrorCode.ValueExpected, [], [SyntaxKind.CloseBraceToken, SyntaxKind.CommaToken]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== SyntaxKind.CloseBraceToken) {
      handleError(ParseErrorCode.CloseBraceExpected, [SyntaxKind.CloseBraceToken], []);
    } else {
      scanNext(); // consume close brace
    }
    return true;
  }

  function parseArray() {
    onArrayBegin();
    scanNext(); // consume open bracket
    let isFirstElement = true;

    let needsComma = false;
    while (_scanner.getToken() !== SyntaxKind.CloseBracketToken && _scanner.getToken() !== SyntaxKind.EOF) {
      if (_scanner.getToken() === SyntaxKind.CommaToken) {
        if (!needsComma) {
          handleError(ParseErrorCode.ValueExpected, [], []);
        }
        onSeparator(",");
        scanNext(); // consume comma
        if (_scanner.getToken() === SyntaxKind.CloseBracketToken && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(ParseErrorCode.CommaExpected, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(ParseErrorCode.ValueExpected, [], [SyntaxKind.CloseBracketToken, SyntaxKind.CommaToken]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop(); // remove array index
    }
    if (_scanner.getToken() !== SyntaxKind.CloseBracketToken) {
      handleError(ParseErrorCode.CloseBracketExpected, [SyntaxKind.CloseBracketToken], []);
    } else {
      scanNext(); // consume close bracket
    }
    return true;
  }

  function parseValue() {
    switch (_scanner.getToken()) {
      case SyntaxKind.OpenBracketToken:
        return parseArray();
      case SyntaxKind.OpenBraceToken:
        return parseObject();
      case SyntaxKind.StringLiteral:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }

  scanNext();
  if (_scanner.getToken() === SyntaxKind.EOF) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(ParseErrorCode.ValueExpected, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(ParseErrorCode.ValueExpected, [], []);
    return false;
  }
  if (_scanner.getToken() !== SyntaxKind.EOF) {
    handleError(ParseErrorCode.EndOfFileExpected, [], []);
  }
  return true;
}

/**
 * Creates a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
export function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0;
  let value = "";
  let tokenOffset = 0;
  let token = SyntaxKind.Unknown;
  let lineNumber = 0;
  let lineStartOffset = 0;
  let tokenLineStartOffset = 0;
  let prevTokenLineStartOffset = 0;
  let scanError = ScanError.None;

  function scanHexDigits(count, exact) {
    let digits = 0;
    let value = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) {
        value = value * 16 + ch - CharacterCodes._0;
      } else if (ch >= CharacterCodes.A && ch <= CharacterCodes.F) {
        value = value * 16 + ch - CharacterCodes.A + 10;
      } else if (ch >= CharacterCodes.a && ch <= CharacterCodes.f) {
        value = value * 16 + ch - CharacterCodes.a + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value = -1;
    }
    return value;
  }

  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = SyntaxKind.Unknown;
    scanError = ScanError.None;
  }

  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === CharacterCodes._0) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === CharacterCodes.dot) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = ScanError.UnexpectedEndOfNumber;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === CharacterCodes.E || text.charCodeAt(pos) === CharacterCodes.e)) {
      pos++;
      if (
        pos < text.length && text.charCodeAt(pos) === CharacterCodes.plus
        || text.charCodeAt(pos) === CharacterCodes.minus
      ) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = ScanError.UnexpectedEndOfNumber;
      }
    }
    return text.substring(start, end);
  }

  function scanString() {
    let result = "";
    let start = pos;

    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = ScanError.UnexpectedEndOfString;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === CharacterCodes.doubleQuote) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === CharacterCodes.backslash) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = ScanError.UnexpectedEndOfString;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case CharacterCodes.doubleQuote:
            result += "\"";
            break;
          case CharacterCodes.backslash:
            result += "\\";
            break;
          case CharacterCodes.slash:
            result += "/";
            break;
          case CharacterCodes.b:
            result += "\b";
            break;
          case CharacterCodes.f:
            result += "\f";
            break;
          case CharacterCodes.n:
            result += "\n";
            break;
          case CharacterCodes.r:
            result += "\r";
            break;
          case CharacterCodes.t:
            result += "\t";
            break;
          case CharacterCodes.u:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = ScanError.InvalidUnicode;
            }
            break;
          default:
            scanError = ScanError.InvalidEscapeCharacter;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 0x1f) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = ScanError.UnexpectedEndOfString;
          break;
        } else {
          scanError = ScanError.InvalidCharacter;
          // mark as error but continue with string
        }
      }
      pos++;
    }
    return result;
  }

  function scanNext() {
    value = "";
    scanError = ScanError.None;

    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;

    if (pos >= len) {
      // at the end
      tokenOffset = len;
      return token = SyntaxKind.EOF;
    }

    let code = text.charCodeAt(pos);
    // trivia: whitespace
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));

      return token = SyntaxKind.Trivia;
    }

    // trivia: newlines
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === CharacterCodes.carriageReturn && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = SyntaxKind.LineBreakTrivia;
    }

    switch (code) {
      // tokens: []{}:,
      case CharacterCodes.openBrace:
        pos++;
        return token = SyntaxKind.OpenBraceToken;
      case CharacterCodes.closeBrace:
        pos++;
        return token = SyntaxKind.CloseBraceToken;
      case CharacterCodes.openBracket:
        pos++;
        return token = SyntaxKind.OpenBracketToken;
      case CharacterCodes.closeBracket:
        pos++;
        return token = SyntaxKind.CloseBracketToken;
      case CharacterCodes.colon:
        pos++;
        return token = SyntaxKind.ColonToken;
      case CharacterCodes.comma:
        pos++;
        return token = SyntaxKind.CommaToken;

      // strings
      case CharacterCodes.doubleQuote:
        pos++;
        value = scanString();
        return token = SyntaxKind.StringLiteral;

      // comments
      case CharacterCodes.slash:
        const start = pos - 1;
        // Single-line comment
        if (text.charCodeAt(pos + 1) === CharacterCodes.slash) {
          pos += 2;

          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = SyntaxKind.LineCommentTrivia;
        }

        // Multi-line comment
        if (text.charCodeAt(pos + 1) === CharacterCodes.asterisk) {
          pos += 2;

          const safeLength = len - 1; // For lookahead.
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);

            if (ch === CharacterCodes.asterisk && text.charCodeAt(pos + 1) === CharacterCodes.slash) {
              pos += 2;
              commentClosed = true;
              break;
            }

            pos++;

            if (isLineBreak(ch)) {
              if (ch === CharacterCodes.carriageReturn && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
                pos++;
              }

              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }

          if (!commentClosed) {
            pos++;
            scanError = ScanError.UnexpectedEndOfComment;
          }

          value = text.substring(start, pos);
          return token = SyntaxKind.BlockCommentTrivia;
        }
        // just a single slash
        value += String.fromCharCode(code);
        pos++;
        return token = SyntaxKind.Unknown;

      // numbers
      case CharacterCodes.minus:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = SyntaxKind.Unknown;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case CharacterCodes._0:
      case CharacterCodes._1:
      case CharacterCodes._2:
      case CharacterCodes._3:
      case CharacterCodes._4:
      case CharacterCodes._5:
      case CharacterCodes._6:
      case CharacterCodes._7:
      case CharacterCodes._8:
      case CharacterCodes._9:
        value += scanNumber();
        return token = SyntaxKind.NumericLiteral;
      // literals and unknown symbols
      default:
        // is a literal? Read the full word.
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          // keywords: true, false, null
          switch (value) {
            case "true":
              return token = SyntaxKind.TrueKeyword;
            case "false":
              return token = SyntaxKind.FalseKeyword;
            case "null":
              return token = SyntaxKind.NullKeyword;
          }
          return token = SyntaxKind.Unknown;
        }
        // some
        value += String.fromCharCode(code);
        pos++;
        return token = SyntaxKind.Unknown;
    }
  }

  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case CharacterCodes.closeBrace:
      case CharacterCodes.closeBracket:
      case CharacterCodes.openBrace:
      case CharacterCodes.openBracket:
      case CharacterCodes.doubleQuote:
      case CharacterCodes.colon:
      case CharacterCodes.comma:
      case CharacterCodes.slash:
        return false;
    }
    return true;
  }

  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= SyntaxKind.LineCommentTrivia && result <= SyntaxKind.Trivia);
    return result;
  }

  return {
    setPosition: setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError,
  };
}

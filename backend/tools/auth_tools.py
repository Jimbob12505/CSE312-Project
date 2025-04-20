def validate_password(password: str) -> bool:
    valid: bool = (is_at_least_eight_chars(password) and
                   contains_lower(password) and
                   contains_upper(password) and
                   contains_number(password) and
                   contains_special_char(password) and
                   not(contains_invalid_char(password)))

    return valid

def special_chars_arr() -> list[str]:
    return ["!", "@", "#", "$", "%", "^", "&", "(", ")", "-", "_", "=", ",", ":"]

def is_special_char(c: str) -> bool:
    special_chars = special_chars_arr()
    return (c in special_chars)

def is_invalid_char(c: str) -> bool:
    return not(c.isalnum() or is_special_char(c))

def is_at_least_eight_chars(string: str) -> bool:
    return (len(string) >= 8)

def contains_lower(string: str) -> bool:
    found: bool = False

    for c in string:
        if(c.islower()):
            found = True
            break

    return found

def contains_upper(string: str) -> bool:
    found: bool = False

    for c in string:
        if (c.isupper()):
            found = True
            break

    return found

def contains_number(string: str) -> bool:
    found: bool = False

    for c in string:
        if (c.isdigit()):
            found = True
            break

    return found

def contains_special_char(string: str) -> bool:
    found: bool = False

    for c in string:
        if (is_special_char(c)):
            found = True
            break

    return found


def contains_invalid_char(string: str) -> bool:
    found: bool = False

    for c in string:
        if (is_invalid_char(c)):
            found = True
            break

    return found

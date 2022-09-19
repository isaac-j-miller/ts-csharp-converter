using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json.Linq;

namespace Serialization
{

    public abstract class TokenTypeHandler<T>
    {
        protected JToken Token;
        public TokenTypeHandler(JToken Token)
        {
            this.Token = Token;
        }
        public abstract T HandleArray();
        public abstract T HandleObject();
        public abstract T HandleInteger();
        public abstract T HandleIntegerWhenPropertyIsFloat();
        public abstract T HandleFloat();
        public abstract T HandleDecimal();
        public abstract T HandleIntegerWhenPropertyIsDecimal();
        public abstract T HandleString();
        public abstract T HandleBoolean();
        public abstract T HandleDate();
        public abstract T HandleGuid();
        public abstract T HandleUri();
        public abstract T HandleNullOrUndefinedIfExpected();
        public abstract T HandleTimeSpan();
        public abstract T HandleDefault();
        protected U? TryConvert<U>(JToken Token)
        {
            try
            {
                return Token.ToObject<U>();
            } catch
            {
                return default;
            }
        }
    }
    public class SerializationUtils
    {
#nullable enable
        public static (T?, double) FindType<T>(JToken Token, NamingStrategy? namingStrategy)
        {
            var t = typeof(T);
            JObject? Obj = null;
#nullable disable
            try
            {

                Obj = (JObject)(Token);
            } catch (InvalidCastException)
            {

            }
            bool isNumeric = t == typeof(double) || t == typeof(float) || t == typeof(decimal);
            bool isNull = Token.Type == JTokenType.Null;
            bool typeIsNullable = Nullable.GetUnderlyingType(t) != null;
            bool tCanBeJsonParsed = !isNumeric && t != typeof(int) && t != typeof(string) && t != typeof(char) && t != typeof(bool);
            if (Obj != null && Obj.Type == JTokenType.Object && tCanBeJsonParsed)
            {
                double totalProperties = 0;
                double matchingProperties = 0;
                var c = JsonConvert.DeserializeObject<T>(Obj.ToString());
                var fields = t.GetFields();
                foreach (var field in fields)
                {
                    totalProperties++;
                    string fieldName = null;
                    var customAttrs = field.GetCustomAttributes(
                        typeof(JsonPropertyAttribute), true);
                    foreach (var attr in customAttrs)
                    {
                        var cast = (JsonPropertyAttribute)attr;
                        fieldName = cast.PropertyName;
                    }
                    if (namingStrategy != null && fieldName == null)
                    {
                        fieldName = namingStrategy.GetPropertyName(field.Name, false);
                    }
                    if (fieldName == null)
                    {
                        fieldName = field.Name;
                    }
                    JToken token = Obj[fieldName];
                    var objectFieldHandler = new FieldOfObjectHandler(token);
                    var propertyType = field.FieldType;
                    matchingProperties += HandleTokenType(propertyType, token, objectFieldHandler);
                }
                if (totalProperties == 0)
                {
                    return (c, 0);
                }
                return (c, matchingProperties / totalProperties);
            }
            if (isNull)
            {
                if (typeIsNullable)
                {
                    return (default, 0.5);
                }
                return (default, 0);
            }
            var handler = new FieldHandler<T>(Token);
             return HandleTokenType(t, Token, handler);
        }
        public static T HandleTokenType<T>(Type Type, JToken Token, TokenTypeHandler<T> Handler)
        {
            if (Token == null)
            {
                if (Nullable.GetUnderlyingType(Type) != null)
                {
                    return Handler.HandleNullOrUndefinedIfExpected();
                }
                return Handler.HandleDefault();
            }
            switch (Token.Type)
            {
                case JTokenType.Array:
                    if (Type.IsArray)
                    {
                        return Handler.HandleArray();
                    }
                    break;
                case JTokenType.Object:
                    if (Type == typeof(object))
                    {
                        return Handler.HandleObject();
                    }
                    break;
                case JTokenType.Integer:
                    if (Type == typeof(int))
                    {
                        return Handler.HandleInteger();
                    }
                    else if (Type == typeof(double) || Type == typeof(float))
                    {
                        return Handler.HandleIntegerWhenPropertyIsFloat();
                    } else if(Type == typeof(decimal))
                    {

                        return Handler.HandleIntegerWhenPropertyIsDecimal();
                    }
                    break;
                case JTokenType.Float:
                    if (Type == typeof(double) || Type == typeof(float))
                    {
                        return Handler.HandleFloat();
                    } else if(Type==typeof(decimal))
                    {
                        return Handler.HandleDecimal();
                    }
                    break;
                case JTokenType.String:
                case JTokenType.Raw:
                case JTokenType.Bytes:
                    if (Type == typeof(string) || Type == typeof(byte[]))
                    {
                        return Handler.HandleString();
                    }
                    break;
                case JTokenType.Boolean:
                    if (Type == typeof(bool))
                    {
                        return Handler.HandleBoolean();
                    }
                    break;
                case JTokenType.Date:
                    if (Type == typeof(DateTime))
                    {
                        return Handler.HandleDate();
                    }
                    break;
                case JTokenType.Guid:
                    if (Type == typeof(Guid))
                    {
                        return Handler.HandleGuid();
                    }
                    break;
                case JTokenType.Uri:
                    if (Type == typeof(Uri))
                    {
                        return Handler.HandleUri();
                    }
                    break;
                case JTokenType.TimeSpan:
                    if (Type == typeof(TimeSpan))
                    {
                        return Handler.HandleTimeSpan();
                    }
                    break;
                case JTokenType.Null:
                case JTokenType.Undefined:
                    if (Nullable.GetUnderlyingType(Type) != null)
                    {
                        return Handler.HandleNullOrUndefinedIfExpected();
                    }
                    return Handler.HandleDefault();
                case JTokenType.Comment:
                case JTokenType.Property:
                case JTokenType.Constructor:
                default:
                    break;
            }
            return Handler.HandleDefault();
        }
    }
    
    class FieldOfObjectHandler : TokenTypeHandler<double>
    {
        public FieldOfObjectHandler(JToken Token) : base(Token) { }
        public override double HandleArray()
        {
            return 0.5;
        }

        public override double HandleBoolean()
        {
            return 1;
        }

        public override double HandleDate()
        {
            return 1;
        }

        public override double HandleFloat()
        {
            return 1;
        }

        public override double HandleDecimal()
        {
            return 1;
        }

        public override double HandleGuid()
        {
            return 1;
        }

        public override double HandleInteger()
        {
            return 1;
        }

        public override double HandleIntegerWhenPropertyIsFloat()
        {
            return 0.75;
        }
        public override double HandleIntegerWhenPropertyIsDecimal()
        {
            return 0.75;
        }

        public override double HandleNullOrUndefinedIfExpected()
        {
            return 0.5;
        }

        public override double HandleDefault()
        {
            return 0;
        }

        public override double HandleObject()
        {
            return 0.5;
        }

        public override double HandleString()
        {
            return 1;
        }

        public override double HandleTimeSpan()
        {
            return 1;
        }

        public override double HandleUri()
        {
            return 1;
        }
    }
#nullable enable
    class FieldHandler<T> : TokenTypeHandler<(T?, double)>
#nullable disable
    {
        public FieldHandler(JToken Token) : base(Token) { }
        public override (T, double) HandleArray()
        {
            var converted = TryConvert<T>(Token);
            if(converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleBoolean()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleDate()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleDefault()
        {
            return (default, 0);
        }

        public override (T, double) HandleFloat()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleDecimal()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleGuid()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleInteger()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleIntegerWhenPropertyIsFloat()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 0.75);
        }

        public override (T, double) HandleIntegerWhenPropertyIsDecimal()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 0.75);
        }

        public override (T, double) HandleNullOrUndefinedIfExpected()
        {
            return (default, 0.5);
        }

        public override (T, double) HandleObject()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 0.75);
        }

        public override (T, double) HandleString()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleTimeSpan()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }

        public override (T, double) HandleUri()
        {
            var converted = TryConvert<T>(Token);
            if (converted == null)
            {
                return (default, 0);
            }
            return (converted, 1);
        }
    }
}
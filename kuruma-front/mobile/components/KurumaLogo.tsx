import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

type KurumaLogoProps = {
  height?: number;
  width?: number;
};

export function KurumaLogo({ height = 72, width = 240 }: KurumaLogoProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 96" fill="none">
      <Rect width="320" height="96" rx="24" fill="#F8FAFC" />

      <G transform="translate(20 16)">
        <Rect width="64" height="64" rx="18" fill="#2563EB" />
        <Path d="M30 0H46L39 64H23L30 0Z" fill="#1D4ED8" />
        <Path d="M34 9H38L37 19H33L34 9Z" fill="#EFF6FF" />
        <Path d="M31 27H35L34 37H30L31 27Z" fill="#EFF6FF" />
        <Path d="M28 45H32L31 55H27L28 45Z" fill="#EFF6FF" />

        <Path
          d="M15.5 38.5C16.4 35 19.4 32.5 23 32.5H42.4C46 32.5 49.1 35 50 38.5L52 46.5C52.5 48.7 50.8 51 48.5 51H16.9C14.6 51 12.9 48.8 13.4 46.5L15.5 38.5Z"
          fill="white"
        />
        <Path
          d="M22.5 26.5H41.5C44.1 26.5 46.3 28.1 47.2 30.5L49 35.5H15L16.8 30.5C17.7 28.1 19.9 26.5 22.5 26.5Z"
          fill="white"
        />
        <Path
          d="M24 31H40C41.2 31 42.3 31.7 42.9 32.8L44.2 35.5H19.8L21.1 32.8C21.7 31.7 22.8 31 24 31Z"
          fill="#BFDBFE"
        />
        <Circle cx="24" cy="51" r="5" fill="#0F172A" />
        <Circle cx="42" cy="51" r="5" fill="#0F172A" />
        <Circle cx="24" cy="51" r="2" fill="#CBD5E1" />
        <Circle cx="42" cy="51" r="2" fill="#CBD5E1" />
      </G>

      <G transform="translate(102 25)">
        <SvgText
          x="0"
          y="32"
          fill="#111827"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="34"
          fontWeight="800">
          Kuruma
        </SvgText>
        <SvgText
          x="2"
          y="55"
          fill="#2563EB"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
          letterSpacing="2">
          ACCIDENT ASSIST
        </SvgText>
      </G>
    </Svg>
  );
}

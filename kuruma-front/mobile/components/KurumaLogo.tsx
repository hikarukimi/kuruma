import { Text, View } from 'react-native';

type KurumaLogoProps = {
  compact?: boolean;
};

export function KurumaLogo({ compact = false }: KurumaLogoProps) {
  return (
    <View
      className={`flex-row items-center rounded-2xl bg-slate-50 ${
        compact ? 'px-0 py-0' : 'px-5 py-4'
      }`}>
      <View className="h-14 w-14 overflow-hidden rounded-2xl bg-blue-600">
        <View className="absolute top-0 left-[29px] h-16 w-4 rotate-[7deg] bg-blue-700" />
        <View className="absolute top-2 left-[33px] h-3 w-1.5 rounded-sm bg-blue-50" />
        <View className="absolute top-6 left-[30px] h-3 w-1.5 rounded-sm bg-blue-50" />
        <View className="absolute top-10 left-[27px] h-3 w-1.5 rounded-sm bg-blue-50" />

        <View className="absolute right-3 bottom-2 left-3 h-4 rounded-md bg-white" />
        <View className="absolute right-4 bottom-[21px] left-4 h-3 rounded-t-lg bg-white" />
        <View className="absolute right-5 bottom-[23px] left-5 h-2 rounded-sm bg-blue-200" />
        <View className="absolute bottom-1.5 left-[17px] h-2.5 w-2.5 rounded-full bg-slate-900" />
        <View className="absolute right-[17px] bottom-1.5 h-2.5 w-2.5 rounded-full bg-slate-900" />
      </View>

      <View className="ml-4">
        <Text className="text-[30px] leading-9 font-extrabold text-gray-900">Kuruma</Text>
        <Text className="mt-0.5 text-xs font-bold tracking-[2px] text-blue-600">
          ACCIDENT ASSIST
        </Text>
      </View>
    </View>
  );
}

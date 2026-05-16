import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginRoute() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = phone.trim().length > 0 && password.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-1 px-6 pt-12">
          <View className="mb-10">
            <Text className="text-[28px] font-bold text-gray-900">登录</Text>
            <Text className="mt-3 text-base leading-6 text-slate-600">
              登录后继续处理事故现场记录和材料提交。
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">手机号</Text>
              <TextInput
                autoCapitalize="none"
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="请输入手机号"
                placeholderTextColor="#94a3b8"
                value={phone}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">密码</Text>
              <TextInput
                autoCapitalize="none"
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                onChangeText={setPassword}
                placeholder="请输入密码"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
              />
            </View>
          </View>

          <Pressable
            className={`mt-8 h-[52px] items-center justify-center rounded-lg ${
              canSubmit ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            disabled={!canSubmit}>
            <Text
              className={`text-[17px] font-bold ${canSubmit ? 'text-white' : 'text-slate-500'}`}>
              登录
            </Text>
          </Pressable>

          <Link href="/register" asChild>
            <Pressable className="mt-3 h-[52px] items-center justify-center rounded-lg border border-slate-300 bg-white">
              <Text className="text-[17px] font-semibold text-slate-700">创建账号</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerUser } from 'services/auth';

type RegisterForm = {
  account: string;
  phone: string;
  displayName: string;
  password: string;
  confirmPassword: string;
};

const initialForm: RegisterForm = {
  account: '',
  phone: '',
  displayName: '',
  password: '',
  confirmPassword: '',
};

function getValidationMessage(form: RegisterForm) {
  if (form.account.trim().length === 0) {
    return '请输入账号';
  }
  if (form.displayName.trim().length === 0) {
    return '请输入姓名';
  }
  if (form.password.length < 8) {
    return '密码至少 8 位';
  }
  if (form.password !== form.confirmPassword) {
    return '两次输入的密码不一致';
  }
  return '';
}

export default function RegisterRoute() {
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validationMessage = useMemo(() => getValidationMessage(form), [form]);
  const canSubmit = !validationMessage && !isSubmitting;

  const updateField = (field: keyof RegisterForm) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
    setIsSuccess(false);
  };

  const submitRegister = async () => {
    if (!canSubmit) {
      setMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      await registerUser({
        account: form.account.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        displayName: form.displayName.trim(),
      });
      setIsSuccess(true);
      setMessage('注册成功，请返回登录');
      setForm(initialForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-10 pt-8"
          keyboardShouldPersistTaps="handled">
          <View className="mb-8">
            <Text className="text-[28px] font-bold text-gray-900">创建账号</Text>
            <Text className="mt-3 text-base leading-6 text-slate-600">
              注册后可继续登录处理事故现场记录和材料提交。
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">账号</Text>
              <TextInput
                autoCapitalize="none"
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                onChangeText={updateField('account')}
                placeholder="请输入账号"
                placeholderTextColor="#94a3b8"
                value={form.account}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">姓名</Text>
              <TextInput
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                onChangeText={updateField('displayName')}
                placeholder="请输入姓名"
                placeholderTextColor="#94a3b8"
                value={form.displayName}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">手机号</Text>
              <TextInput
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                keyboardType="phone-pad"
                onChangeText={updateField('phone')}
                placeholder="可选"
                placeholderTextColor="#94a3b8"
                value={form.phone}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">密码</Text>
              <TextInput
                autoCapitalize="none"
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                onChangeText={updateField('password')}
                placeholder="至少 8 位"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={form.password}
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-slate-700">确认密码</Text>
              <TextInput
                autoCapitalize="none"
                className="h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-base text-gray-900"
                onChangeText={updateField('confirmPassword')}
                placeholder="请再次输入密码"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={form.confirmPassword}
              />
            </View>
          </View>

          {message ? (
            <Text
              className={`mt-5 text-sm font-medium ${isSuccess ? 'text-green-700' : 'text-red-600'}`}>
              {message}
            </Text>
          ) : null}

          <Pressable
            className={`mt-7 h-[52px] flex-row items-center justify-center rounded-lg ${
              canSubmit ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            disabled={!canSubmit}
            onPress={submitRegister}>
            {isSubmitting ? <ActivityIndicator color="#ffffff" size="small" /> : null}
            <Text
              className={`text-[17px] font-bold ${isSubmitting ? 'ml-2' : ''} ${
                canSubmit ? 'text-white' : 'text-slate-500'
              }`}>
              {isSubmitting ? '注册中...' : '注册'}
            </Text>
          </Pressable>

          <Pressable
            className="mt-3 h-[52px] items-center justify-center rounded-lg border border-slate-300 bg-white"
            onPress={() => router.back()}>
            <Text className="text-[17px] font-semibold text-slate-700">返回登录</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

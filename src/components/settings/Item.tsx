import { useDebounceFn } from 'ahooks';
import { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useSectionContext } from './Section';
import { useTheme } from '../../App';
import * as R from 'ramda';
import FormItem from 'antd/es/form/FormItem';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const DEBOUNCE_DELAY = 200;

export interface ItemProps {
  settingKey: string;
  label: string;
  children: React.ReactElement;
  valuePropName?: string;
  description?: React.ReactNode;
  validator?: <T = unknown>(
    value: T,
  ) => string | undefined | Promise<string | undefined>;
}

export const Item: React.FC<ItemProps> = ({
  settingKey,
  children,
  label,
  valuePropName = 'value',
  description,
  validator = R.always(''),
}) => {
  const context = useSectionContext();
  const { value, setValue } = useSettings(context.name, settingKey);
  const [internalValue, setInternalValue] = useState(value);
  const [errorMessage, setErrorMessage] = useState('');
  const { isDark } = useTheme();
  const uniqueId = `settings-${context.name}-${settingKey}`;
  const labelId = `label-${uniqueId}`;
  const descriptionId = `description-${uniqueId}`;

  const debouncedTrySetValue = useDebounceFn(
    async (val) => {
      const validateResult = await validator(val);
      if (validateResult) {
        setErrorMessage(validateResult);
        return;
      }
      setErrorMessage('');
      setValue(val);
    },
    {
      wait: DEBOUNCE_DELAY,
    },
  );

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <section className="mb-5" aria-labelledby={labelId} tabIndex={0}>
      <div className="mb-3 flex items-center">
        <label
          id={labelId}
          className="text-sm font-medium"
          htmlFor={uniqueId}
          title={label}
          style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
        >
          {label}
        </label>
        {description && (
          <>
            <Tooltip title={description}>
              <QuestionCircleOutlined
                className="ml-1"
                style={{ color: 'var(--ant-color-primary)' }}
                aria-hidden
              />
            </Tooltip>
            <p className="sr-only" id={descriptionId} role="tooltip">
              {description}
            </p>
          </>
        )}
      </div>
      <FormItem noStyle validateStatus={errorMessage ? 'error' : 'success'}>
        <children.type
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          id={uniqueId}
          onChange={async (e: any) => {
            const val = e?.target ? e.target[valuePropName] : e;
            setInternalValue(val);
            debouncedTrySetValue.run(val);
          }}
          {...{ [valuePropName]: internalValue, ...children.props }}
        />
        {errorMessage && (
          <div
            className="text-sm mt-1"
            style={{ color: 'var(--ant-color-error)' }}
          >
            {errorMessage}
          </div>
        )}
      </FormItem>
    </section>
  );
};
